/**
 * VideoManager — 100% Cloudinary, no external video API
 *
 * Compression strategy (all server-side via Cloudinary):
 *
 *  1. UPLOAD PRESET (Cloudinary Dashboard → Settings → Upload → Herovideo):
 *       `eager`, `eager_async` and `overwrite` are NOT allowed in unsigned
 *       upload requests — configure them once in the preset's Transform tab:
 *         Eager: sp_hd/f_m3u8
 *         Eager: f_mp4,q_auto,vc_h264,w_1920,h_1080,c_limit
 *         Eager: f_webm,q_auto,vc_vp9,w_1920,h_1080,c_limit
 *         Eager: f_jpg,q_auto,so_0,w_1280
 *         eager_async: true   ← prevents timeouts on large videos
 *         overwrite:   true   ← required for the replace flow
 *
 *  2. POST-UPLOAD EXPLICIT via Supabase edge function (signed):
 *     After each upload the client fires POST ?eager=1&id=<public_id> to the
 *     edge function, which calls Cloudinary's signed `explicit` endpoint to
 *     pre-warm all derivatives — belt-and-suspenders on top of the preset.
 *
 *  3. DELIVERY URLs always carry q_auto and format/codec params so every
 *     video is served optimally regardless of when it was uploaded.
 *
 *  4. CHUNKED upload (6 MB chunks) — reliable for any file size.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Upload, Trash2, Edit3, Save, X, Search, Link, Play,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink, AlertCircle,
  CheckCircle, Loader2, Copy, Tag, FileVideo, UploadCloud, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSiteContent } from '../../hooks/useSiteContent';
import EditableContent from '../EditableContent';
import {
  cloudinaryHlsUrl,
  cloudinaryMp4Url,
  cloudinaryPosterUrl,
  bustHeroCache,
} from '../../utils/heroPreload';

// ─── Config ───────────────────────────────────────────────────────────────────

const CLOUD         = 'dq6jxbyrg';
const UPLOAD_PRESET = 'Herovideo';
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`;

const EDGE_URL = 'https://pbqeljimuerxatrtmgsn.supabase.co/functions/v1/cloudinary-videos';
const EDGE_KEY = 't4fr3ZXEo_duMoZiGY_FqtFWUfw';

/** Chunk size for chunked uploads — 6 MB is well within Cloudinary's limits */
const CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

// ─── Cloudinary eager transformation presets ──────────────────────────────────
//
// IMPORTANT: `eager` cannot be sent in unsigned upload requests.
// Two-pronged approach used here:
//
//  A) UPLOAD PRESET (Cloudinary Dashboard → Settings → Upload → Herovideo):
//     Configure these in the preset's Transform tab so they run automatically
//     on every upload:
//       • Eager: sp_hd/f_m3u8
//       • Eager: f_mp4,q_auto,vc_h264,w_1920,h_1080,c_limit
//       • Eager: f_webm,q_auto,vc_vp9,w_1920,h_1080,c_limit
//       • Eager: f_jpg,q_auto,so_0,w_1280
//       • eager_async: true  (set in preset so large videos don't time out)
//       • overwrite: true    (needed for replace flow)
//
//  B) POST-UPLOAD EXPLICIT CALL via Supabase edge function (signed):
//     After a successful upload the client fires a POST ?eager=1&id=<public_id>
//     to the edge function which calls Cloudinary's signed `explicit` endpoint
//     with the same transformations — ensuring they are pre-warmed even if the
//     preset config is incomplete.
//
// The EAGER_ALL string below is used by the edge function's explicit call.

const EAGER_ALL = [
  // HLS adaptive stream — sp_hd profile handles codec/bitrate rungs automatically
  'sp_hd/f_m3u8',
  // MP4 H.264 — params alphabetized within component per Cloudinary requirement
  'f_mp4,q_auto,vc_h264,w_1920,h_1080,c_limit',
  // WebM VP9 — best compression for Chrome/Firefox
  'f_webm,q_auto,vc_vp9,w_1920,h_1080,c_limit',
  // Poster frame — first frame, 1280 px wide JPEG
  'f_jpg,q_auto,so_0,w_1280',
].join('|');

// ─── Optimised delivery URL builders ──────────────────────────────────────────
//
// All delivery URLs carry compression + format params so even assets that
// were uploaded before this update are served optimally.

const CLD_BASE = `https://res.cloudinary.com/${CLOUD}`;

const optimisedHlsUrl = (publicId: string) =>
  `${CLD_BASE}/video/upload/sp_hd/f_m3u8/${publicId}.m3u8`;

const optimisedMp4Url = (publicId: string) =>
  `${CLD_BASE}/video/upload/c_limit,f_mp4,h_1080,q_auto,vc_h264,w_1920/${publicId}.mp4`;

const optimisedWebmUrl = (publicId: string) =>
  `${CLD_BASE}/video/upload/c_limit,f_webm,h_1080,q_auto,vc_vp9,w_1920/${publicId}.webm`;

const optimisedPosterUrl = (publicId: string, w = 640) =>
  `${CLD_BASE}/video/upload/f_jpg,q_auto,so_0,w_${w}/${publicId}.jpg`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CldVideo {
  public_id:    string;
  display_name: string;
  filename:     string;
  asset_folder: string;
  created_at:   string;
  bytes:        number;
  duration?:    number;
  format:       string;
  width?:       number;
  height?:      number;
  secure_url:   string;
  context?:     { custom?: { caption?: string; alt?: string } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const title = (v: CldVideo) =>
  v.context?.custom?.caption || v.display_name || v.filename || v.public_id.replace(/^.*\//, '');

const isHero = (v: CldVideo) => /herovideo/i.test(v.public_id);

const formatBytes = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

// ─── Edge API helper ──────────────────────────────────────────────────────────

const edgeFetch = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${EDGE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-api-key': EDGE_KEY, ...(init.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
};

// ─── Chunked upload ───────────────────────────────────────────────────────────
//
// Protocol: POST /video/upload with Content-Range + X-Unique-Upload-Id headers.
// Each chunk carries the same preset, public_id and context.
// The final chunk response contains the full asset metadata.
//
// NOTE: `eager`, `eager_async`, `overwrite` and `invalidate` are NOT allowed
// in unsigned upload requests. They must be configured in the Cloudinary
// upload preset (Dashboard → Settings → Upload → Presets → Herovideo →
// Transform tab). See: https://cloudinary.com/documentation/upload_presets

interface UploadResult { public_id: string }

async function cldUpload(
  file: File,
  opts: {
    publicId:   string;
    onProgress: (pct: number) => void;
    signal?:    AbortSignal;
    caption?:   string;
    alt?:       string;
  }
): Promise<UploadResult> {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const total    = file.size;
  let   offset   = 0;
  let   result: UploadResult | null = null;

  while (offset < total) {
    if (opts.signal?.aborted) throw new Error('cancelled');

    const end   = Math.min(offset + CHUNK_SIZE_BYTES, total);
    const chunk = file.slice(offset, end);

    const fd = new FormData();
    fd.append('file', chunk);
    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('public_id', opts.publicId.replace(/^.*\//, ''));
    fd.append('asset_folder', 'Herovideo');
    // context is allowed in unsigned uploads
    if (opts.caption || opts.alt) {
      const parts: string[] = [];
      if (opts.caption) parts.push(`caption=${opts.caption}`);
      if (opts.alt)     parts.push(`alt=${opts.alt}`);
      fd.append('context', parts.join('|'));
    }

    const chunkResult = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const overall = Math.round(((offset + (e.loaded / e.total) * (end - offset)) / total) * 100);
          opts.onProgress(overall);
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Ugyldigt svar fra Cloudinary')); }
        } else {
          let msg = `Cloudinary fejlede (${xhr.status})`;
          try { msg = JSON.parse(xhr.responseText)?.error?.message ?? msg; } catch {}
          reject(new Error(msg));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Netværksfejl under upload')));
      xhr.addEventListener('abort', () => reject(new Error('cancelled')));
      opts.signal?.addEventListener('abort', () => xhr.abort());

      xhr.open('POST', UPLOAD_URL);
      xhr.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${total}`);
      xhr.setRequestHeader('X-Unique-Upload-Id', uniqueId);
      xhr.send(fd);
    });

    result = chunkResult;
    offset = end;
    opts.onProgress(Math.round((offset / total) * 100));
  }

  if (!result) throw new Error('Upload producerede intet resultat');
  return result as UploadResult;
}

// ─── EagerBadge — polls until HLS manifest is ready ──────────────────────────

const EagerBadge: React.FC<{ publicId: string }> = ({ publicId }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 36; // 36 × 5 s = 3 min
    const url = optimisedHlsUrl(publicId);

    const check = async () => {
      try {
        const r = await fetch(url, { method: 'HEAD' });
        if (r.ok) { setReady(true); return; }
      } catch {}
      if (++attempts < maxAttempts) setTimeout(check, 5000);
    };

    const t = setTimeout(check, 4000);
    return () => clearTimeout(t);
  }, [publicId]);

  return ready ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
      <Zap size={9} /> Optimeret
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 animate-pulse">
      <Loader2 size={9} className="animate-spin" /> Optimerer…
    </span>
  );
};

// ─── CompressionInfoPanel ─────────────────────────────────────────────────────

const CompressionInfoPanel: React.FC<{ isHeroVideo?: boolean }> = ({ isHeroVideo }) => (
  <div className={`rounded-xl p-3 border text-xs space-y-1.5 ${isHeroVideo ? 'bg-primary/8 border-primary/25' : 'bg-neutral-900/60 border-neutral-700'}`}>
    <p className={`font-semibold flex items-center gap-1.5 ${isHeroVideo ? 'text-primary' : 'text-neutral-300'}`}>
      <Zap size={12} className={isHeroVideo ? 'text-primary' : 'text-amber-400'} />
      Automatisk Cloudinary optimering ved upload
    </p>
    <ul className={`space-y-1 pl-0.5 ${isHeroVideo ? 'text-primary/70' : 'text-neutral-400'}`}>
      <li>• <strong>HLS adaptiv stream</strong> — serverer rigtig bitrate til brugerens forbindelseshastighed</li>
      <li>• <strong>MP4 + WebM</strong> forudgenereres straks — ingen ventetid for første besøgende</li>
      <li>• <strong>q_auto</strong> intelligent komprimering — typisk 60–80 % lavere filstørrelse</li>
      <li>• <strong>1080p max</strong> — resolutionsloft til web (c_limit)</li>
      <li>• <strong>Chunked upload</strong> — filer opdeles i 6 MB bidder for pålidelig overførsel</li>
    </ul>
  </div>
);

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ ok }: { ok: boolean }) =>
  ok ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
      <CheckCircle size={10} /> <EditableContent contentKey="video-status-live" as="span" fallback="aktiv" />
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
      <AlertCircle size={10} /> <EditableContent contentKey="video-status-error" as="span" fallback="fejl" />
    </span>
  );

// ─── AssignModal ──────────────────────────────────────────────────────────────

const AssignModal: React.FC<{ video: CldVideo; onClose: () => void }> = ({ video, onClose }) => {
  const { updateContent } = useSiteContent();
  const [key, setKey]       = useState('');
  const [saving, setSaving] = useState(false);
  // Always store the optimised HLS URL so hero gets compression for free
  const url = optimisedHlsUrl(video.public_id);

  const handleAssign = async () => {
    if (!key.trim()) { toast.error('Angiv venligst en indholdsnøgle'); return; }
    setSaving(true);
    const ok = await updateContent(key.trim(), url);
    if (ok) { toast.success(`Tildelte "${title(video)}" → ${key.trim()}`); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-neutral-700">
          <div>
            <EditableContent contentKey="video-assign-modal-title" as="h2" className="font-bold text-white text-lg" fallback="Tildel til redigerbart indhold" />
            <p className="text-neutral-400 text-sm mt-0.5 truncate max-w-xs">{title(video)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-700 rounded-lg transition-colors">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        <div className="mx-5 mt-4 bg-neutral-900/60 rounded-xl p-3 flex items-center gap-3 border border-neutral-700">
          <Link size={14} className="text-primary shrink-0" />
          <span className="text-xs text-neutral-300 font-mono break-all">{url}</span>
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Kopieret!'); }} className="ml-auto p-1 hover:bg-neutral-700 rounded">
            <Copy size={12} className="text-neutral-400" />
          </button>
        </div>

        <p className="mx-5 mt-2 text-xs text-neutral-500 flex items-center gap-1.5">
          <Zap size={10} className="text-amber-400" />
          URL inkluderer automatisk komprimering (q_auto · H.264 · HLS sp_hd · 1080p).
        </p>

        <div className="p-5">
          <EditableContent contentKey="video-assign-key-label" as="label" className="text-sm text-neutral-300 mb-1.5 block" fallback="Indholdsnøgle" />
          <input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="f.eks. hero-video-url"
            className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder-neutral-500" />
          <p className="text-xs text-neutral-500 mt-1.5">
            <EditableContent contentKey="video-assign-key-hint" as="span" fallback="Denne nøgle skal matche præcis det, der bruges i din" />{' '}
            <code className="text-primary">&lt;EditableContent contentKey="..."&gt;</code>
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
            <EditableContent contentKey="video-btn-cancel" as="span" fallback="Annuller" />
          </button>
          <button onClick={handleAssign} disabled={saving || !key.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <EditableContent contentKey="video-btn-assign" as="span" fallback="Tildel" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Shared Dropzone ──────────────────────────────────────────────────────────

type Stage = 'idle' | 'uploading' | 'done';

interface DropzoneProps {
  file:      File | null;
  onChange:  (f: File | null) => void;
  disabled?: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ file, onChange, disabled }) => {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={ref} type="file" accept="video/*" className="hidden"
        onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!disabled) onChange(e.dataTransfer.files[0] ?? null); }}
        onClick={() => { if (!disabled) ref.current?.click(); }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${disabled ? 'pointer-events-none opacity-60' : ''}
          ${dragOver ? 'border-primary bg-primary/10' : file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-neutral-600 hover:border-neutral-400 hover:bg-neutral-700/30'}`}
      >
        {file ? (
          <div className="flex items-center gap-3 justify-center">
            <FileVideo size={20} className="text-emerald-400 shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm text-white font-medium truncate">{file.name}</p>
              <p className="text-xs text-neutral-400">{formatBytes(file.size)}</p>
            </div>
            {!disabled && (
              <button onClick={(e) => { e.stopPropagation(); onChange(null); }} className="ml-auto p-1 text-neutral-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div>
            <UploadCloud size={28} className="mx-auto text-neutral-500 mb-2" />
            <p className="text-sm text-neutral-300">
              <EditableContent contentKey="video-upload-dropzone-click" as="span" className="text-primary font-medium" fallback="Klik for at vælge" />{' '}
              <EditableContent contentKey="video-upload-dropzone-or-drop" as="span" fallback="eller træk og slip" />
            </p>
            <EditableContent contentKey="video-upload-dropzone-formats" as="p" className="text-xs text-neutral-500 mt-1" fallback="MP4, MOV, WebM og andre videoformater" />
          </div>
        )}
      </div>
    </>
  );
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ pct: number; label: string; done?: boolean }> = ({ pct, label, done }) => (
  <div className="bg-neutral-900/60 rounded-xl p-4 border border-neutral-700 space-y-2">
    <div className="flex items-center gap-2">
      {done
        ? <CheckCircle size={16} className="text-emerald-400 shrink-0" />
        : <Loader2 size={16} className="animate-spin text-primary shrink-0" />}
      <span className={`text-sm font-medium ${done ? 'text-emerald-400' : 'text-white'}`}>{label}</span>
    </div>
    <div className="w-full bg-neutral-700 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-200 ${done ? 'bg-emerald-500' : 'bg-primary'}`}
        style={{ width: `${pct}%` }} />
    </div>
  </div>
);

// ─── UploadModal ──────────────────────────────────────────────────────────────

const UploadModal: React.FC<{ onClose: () => void; onCreated: (v: CldVideo) => void }> = ({ onClose, onCreated }) => {
  const [videoTitle, setVideoTitle]   = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile]   = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [pct, setPct]     = useState(0);
  const [err, setErr]     = useState<string | null>(null);
  const [newPublicId, setNewPublicId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const handleUpload = async () => {
    if (!videoTitle.trim()) { toast.error('Titel er påkrævet'); return; }
    if (!file)              { toast.error('Vælg venligst en videofil'); return; }

    setErr(null); setStage('uploading'); setPct(0);
    abort.current = new AbortController();

    try {
      const safe = videoTitle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      const result = await cldUpload(file, {
        publicId:   safe,
        onProgress: setPct,
        signal:     abort.current.signal,
        caption:    videoTitle.trim(),
        alt:        description.trim(),
      });

      setNewPublicId(result.public_id);
      setStage('done');
      toast.success('Video uploadet — Cloudinary optimerer nu i baggrunden…');

      // Fire-and-forget: ask the signed edge function to call Cloudinary's
      // `explicit` endpoint so HLS/MP4/WebM/poster are pre-generated now.
      edgeFetch(
        `?eager=1&id=${encodeURIComponent(result.public_id)}`,
        { method: 'POST' }
      ).catch((e) => console.warn('Eager pre-warm failed (non-fatal):', e.message));

      // If this is the hero video, bust the browser's cached poster + manifest
      // so HeroVideoSection shows the new video on next load — zero speed impact
      // (runs in requestIdleCallback, fully off the critical path).
      if (/herovideo/i.test(result.public_id)) {
        bustHeroCache(result.public_id);
      }

      const newVideo: CldVideo = {
        public_id:    result.public_id,
        display_name: videoTitle.trim(),
        filename:     file.name,
        asset_folder: 'Herovideo',
        format:       'mp4',
        created_at:   new Date().toISOString(),
        bytes:        file.size,
        secure_url:   optimisedMp4Url(result.public_id),
        context:      { custom: { caption: videoTitle.trim(), alt: description.trim() } },
      };
      setTimeout(() => onCreated(newVideo), 800);

    } catch (e: any) {
      if (e.message === 'cancelled') return;
      setErr(e.message ?? 'Upload fejlede');
      setStage('idle');
    }
  };

  const isBusy = stage === 'uploading';
  const isDone = stage === 'done';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-700">
          <EditableContent contentKey="video-upload-modal-title" as="h2" className="font-bold text-white text-lg" fallback="Upload video" />
          <button onClick={() => { abort.current?.abort(); onClose(); }} disabled={isDone} className="p-2 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-40">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <EditableContent contentKey="video-upload-title-label" as="label" className="text-sm text-neutral-300 mb-1.5 block" fallback="Titel *" />
            <input type="text" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Min fantastiske video" disabled={isBusy || isDone}
              className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder-neutral-500 disabled:opacity-50" />
            {videoTitle.trim() && (
              <p className="text-xs text-neutral-500 mt-1">
                Cloudinary ID: <span className="font-mono text-primary">{videoTitle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')}</span>
              </p>
            )}
          </div>

          <div>
            <EditableContent contentKey="video-upload-description-label" as="label" className="text-sm text-neutral-300 mb-1.5 block" fallback="Beskrivelse" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Valgfri beskrivelse…" rows={2} disabled={isBusy || isDone}
              className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder-neutral-500 resize-none disabled:opacity-50" />
          </div>

          <div>
            <EditableContent contentKey="video-upload-file-label" as="label" className="text-sm text-neutral-300 mb-1.5 block" fallback="Videofil *" />
            <Dropzone file={file} onChange={setFile} disabled={isBusy || isDone} />
          </div>

          {/* Compression info shown before upload */}
          {!isBusy && !isDone && <CompressionInfoPanel />}

          {/* Upload progress */}
          {(isBusy || isDone) && (
            <ProgressBar
              pct={isDone ? 100 : pct}
              label={isDone ? 'Overført — Cloudinary optimerer nu i baggrunden…' : `Uploader… ${pct}%`}
              done={isDone}
            />
          )}

          {/* Eager processing status after done */}
          {isDone && newPublicId && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <EagerBadge publicId={newPublicId} />
              <span>HLS + MP4 + WebM forberedes på Cloudinary</span>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl p-3 text-error">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs">{err}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-700">
          <button onClick={() => { abort.current?.abort(); onClose(); }} disabled={isDone} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40">
            {isBusy ? <EditableContent contentKey="video-btn-cancel" as="span" fallback="Annuller" /> : <EditableContent contentKey="video-btn-close" as="span" fallback="Luk" />}
          </button>
          <button onClick={handleUpload} disabled={isBusy || isDone || !videoTitle.trim() || !file}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : isDone ? <CheckCircle size={14} /> : <Upload size={14} />}
            {isBusy
              ? <EditableContent contentKey="video-btn-uploading" as="span" fallback="Uploader…" />
              : isDone
                ? <EditableContent contentKey="video-btn-done" as="span" fallback="Færdig" />
                : <EditableContent contentKey="video-btn-upload" as="span" fallback="Upload" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ReplaceVideoModal ────────────────────────────────────────────────────────

const ReplaceVideoModal: React.FC<{
  video:      CldVideo;
  onClose:    () => void;
  onReplaced: (v: CldVideo) => void;
}> = ({ video, onClose, onReplaced }) => {
  const [file, setFile]   = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [pct, setPct]     = useState(0);
  const [err, setErr]     = useState<string | null>(null);
  const [replacedId, setReplacedId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const hero  = isHero(video);

  const handleReplace = async () => {
    if (!file) { toast.error('Vælg venligst en videofil'); return; }

    setErr(null); setStage('uploading'); setPct(0);
    abort.current = new AbortController();

    const savedPublicId = video.public_id;
    const savedCaption  = title(video);
    const savedAlt      = video.context?.custom?.alt ?? '';
    const savedBareId   = savedPublicId.replace(/^.*\//, '');

    try {
      // Step 1 — hard-delete existing asset + all derived assets from CDN
      await edgeFetch(
        `?id=${encodeURIComponent(savedPublicId)}&invalidate=true`,
        { method: 'DELETE' }
      );

      // Step 2 — re-upload to same public_id.
      // overwrite/invalidate cannot be sent in unsigned requests — they must
      // be enabled in the upload preset (Herovideo preset → overwrite: true).
      await cldUpload(file, {
        publicId:   savedBareId,
        onProgress: setPct,
        signal:     abort.current.signal,
        caption:    savedCaption,
        alt:        savedAlt,
      });

      // Step 3 — fire-and-forget: ask the edge function to call Cloudinary's
      // signed `explicit` endpoint so eager transformations (HLS/MP4/WebM/poster)
      // are pre-generated server-side now. The edge function holds the API secret.
      edgeFetch(
        `?eager=1&id=${encodeURIComponent(savedPublicId)}`,
        { method: 'POST' }
      ).catch((e) => console.warn('Eager pre-warm failed (non-fatal):', e.message));

      // Bust the browser's cached hero poster + HLS manifest so HeroVideoSection
      // displays the new video immediately on next visit — runs in rIC, zero
      // impact on loading speed.
      bustHeroCache(savedPublicId);

      setReplacedId(savedPublicId);
      setStage('done');
      toast.success('Video erstattet — Cloudinary optimerer nu i baggrunden…');

      setTimeout(
        () => onReplaced({ ...video, bytes: file.size, created_at: new Date().toISOString() }),
        800
      );

    } catch (e: any) {
      if (e.message === 'cancelled') return;
      setErr(e.message ?? 'Erstatning fejlede');
      setStage('idle');
    }
  };

  const isBusy = stage === 'uploading';
  const isDone = stage === 'done';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-700">
          <div>
            <EditableContent contentKey="video-replace-modal-title" as="h2" className="font-bold text-white text-lg" fallback="Erstat video" />
            <p className="text-neutral-400 text-sm mt-0.5 truncate max-w-xs">{title(video)}</p>
          </div>
          <button onClick={() => { abort.current?.abort(); onClose(); }} disabled={isDone} className="p-2 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-40">
            <X size={18} className="text-neutral-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Hero / public_id notice */}
          <div className={`rounded-xl p-3 flex items-start gap-2 border ${hero ? 'bg-primary/10 border-primary/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <AlertCircle size={15} className={`shrink-0 mt-0.5 ${hero ? 'text-primary' : 'text-amber-400'}`} />
            <div className="text-xs space-y-1">
              {hero && <p className="text-primary font-medium">Dette er hero-videoen</p>}
              <p className={hero ? 'text-primary/80' : 'text-amber-300'}>
                Filen uploades til det samme Cloudinary ID{' '}
                <code className="font-mono bg-black/20 px-1 rounded">{video.public_id}</code> — navn, URL og alle tildelinger forbliver uændrede.
              </p>
            </div>
          </div>

          {/* Compression info */}
          {!isBusy && !isDone && <CompressionInfoPanel isHeroVideo={hero} />}

          <div>
            <EditableContent contentKey="video-replace-file-label" as="label" className="text-sm text-neutral-300 mb-1.5 block" fallback="Ny videofil *" />
            <Dropzone file={file} onChange={setFile} disabled={isBusy || isDone} />
          </div>

          {(isBusy || isDone) && (
            <ProgressBar
              pct={isDone ? 100 : pct}
              label={isDone ? 'Overført — Cloudinary optimerer nu i baggrunden…' : `Uploader… ${pct}%`}
              done={isDone}
            />
          )}

          {isDone && replacedId && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <EagerBadge publicId={replacedId} />
              <span>HLS + MP4 + WebM forberedes på Cloudinary</span>
            </div>
          )}

          {err && (
            <div className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl p-3 text-error">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs">{err}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-700">
          <button onClick={() => { abort.current?.abort(); onClose(); }} disabled={isDone} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-40">
            {isBusy
              ? <EditableContent contentKey="video-btn-cancel" as="span" fallback="Annuller" />
              : <EditableContent contentKey="video-btn-close" as="span" fallback="Luk" />}
          </button>
          <button onClick={handleReplace} disabled={isBusy || isDone || !file}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : isDone ? <CheckCircle size={14} /> : <RefreshCw size={14} />}
            {isBusy
              ? <EditableContent contentKey="video-btn-replacing" as="span" fallback="Uploader…" />
              : isDone
                ? <EditableContent contentKey="video-btn-done" as="span" fallback="Færdig" />
                : <EditableContent contentKey="video-btn-replace" as="span" fallback="Erstat" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── VideoRow ─────────────────────────────────────────────────────────────────

const VideoRow: React.FC<{
  video:     CldVideo;
  onDeleted: (id: string) => void;
  onUpdated: (v: CldVideo) => void;
  onAssign:  (v: CldVideo) => void;
  onReplace: (v: CldVideo) => void;
}> = ({ video, onDeleted, onUpdated, onAssign, onReplace }) => {
  const [expanded, setExpanded]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editTitle, setEditTitle]         = useState(title(video));
  const [editDesc, setEditDesc]           = useState(video.context?.custom?.alt ?? '');
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hlsUrl  = optimisedHlsUrl(video.public_id);
  const mp4Url  = optimisedMp4Url(video.public_id);
  const webmUrl = optimisedWebmUrl(video.public_id);
  const poster  = optimisedPosterUrl(video.public_id, 320);
  const hero    = isHero(video);

  const handleSave = async () => {
    const newCaption = editTitle.trim();
    const newAlt     = editDesc.trim();
    if (!newCaption) { toast.error('Titel er påkrævet'); return; }

    setSaving(true);
    const updated = {
      ...video,
      display_name: newCaption,
      context: { custom: { caption: newCaption, alt: newAlt } },
    };
    onUpdated(updated);
    setEditing(false);
    toast.success('Opdateret');

    try {
      await edgeFetch(`?id=${encodeURIComponent(video.public_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: newCaption, alt: newAlt }),
      });
    } catch (e: any) {
      console.warn('Cloudinary context update failed:', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await edgeFetch(`?id=${encodeURIComponent(video.public_id)}&invalidate=true`, { method: 'DELETE' });
      onDeleted(video.public_id);
      toast.success(hero ? 'Hero-video slettet — hjemmesiden viser nu en sort baggrund' : 'Slettet');
    } catch (e: any) {
      toast.error(e.message ?? 'Sletning fejlede');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${hero ? 'bg-primary/5 border-primary/30' : 'bg-neutral-700/20 border-neutral-700'}`}>
      <div className="flex items-center gap-4 p-4">
        <div className="w-14 h-10 bg-neutral-700 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden">
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <Play size={16} className="text-neutral-400 relative z-10" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-white text-sm w-full focus:outline-none focus:border-primary" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-white text-sm truncate">{title(video)}</p>
              {hero && (
                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">hero</span>
              )}
            </div>
          )}
          <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate">{video.public_id}</p>
        </div>

        <StatusBadge ok={true} />

        <span className="text-xs text-neutral-500 shrink-0 hidden sm:block">
          {new Date(video.created_at).toLocaleDateString('da-DK')}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="p-1.5 bg-success/20 text-success rounded-lg hover:bg-success/30 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              </button>
              <button onClick={() => { setEditing(false); setEditTitle(title(video)); setEditDesc(video.context?.custom?.alt ?? ''); }}
                className="p-1.5 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onAssign(video)} className="p-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors" title="Tildel til redigerbart indhold">
                <Tag size={14} />
              </button>
              <button onClick={() => { navigator.clipboard.writeText(hlsUrl); toast.success('URL kopieret!'); }}
                className="p-1.5 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors" title="Kopiér optimeret HLS URL">
                <Copy size={14} />
              </button>
              <button onClick={() => { setEditing(true); setExpanded(true); }}
                className="p-1.5 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors" title="Rediger metadata">
                <Edit3 size={14} />
              </button>
              <button onClick={() => onReplace(video)}
                className="p-1.5 bg-amber-500/10 text-amber-500/70 rounded-lg hover:bg-amber-500/20 hover:text-amber-400 transition-colors" title="Erstat videofil">
                <RefreshCw size={14} />
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  {hero && <span className="text-xs text-amber-400 font-medium mr-1">Hero!</span>}
                  <button onClick={handleDelete} disabled={deleting} className="px-2 py-1 bg-error text-white rounded-lg hover:bg-error/80 text-xs font-medium transition-colors">
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Slet permanent'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="p-1.5 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className={`p-1.5 rounded-lg transition-colors ${hero ? 'bg-amber-500/10 text-amber-500/70 hover:bg-amber-500/20 hover:text-amber-400' : 'bg-error/10 text-error/70 hover:bg-error/20 hover:text-error'}`} title="Slet">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setExpanded((v) => !v)} className="p-1.5 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-neutral-700/50 pt-3 space-y-3">
          {editing && (
            <div>
              <EditableContent contentKey="video-row-description-label" as="label" className="text-xs text-neutral-400 mb-1 block" fallback="Beskrivelse" />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2}
                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none" />
            </div>
          )}
          {!editing && video.context?.custom?.alt && (
            <p className="text-sm text-neutral-400">{video.context.custom.alt}</p>
          )}

          {/* Optimised URL row — shows HLS URL with compression params baked in */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-neutral-900/60 rounded-lg px-3 py-2 flex-1 min-w-0 border border-neutral-700">
              <Zap size={11} className="text-amber-400 shrink-0" title="URL inkluderer q_auto + sp_hd HLS" />
              <span className="text-xs font-mono text-neutral-300 break-all">{hlsUrl}</span>
            </div>
            <a href={mp4Url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-700 text-neutral-300 text-xs rounded-lg hover:bg-neutral-600 transition-colors whitespace-nowrap">
              <Play size={12} /> MP4
            </a>
            <a href={webmUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-700 text-neutral-300 text-xs rounded-lg hover:bg-neutral-600 transition-colors whitespace-nowrap">
              <Play size={12} /> WebM
            </a>
          </div>

          <p className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Zap size={10} className="text-amber-400" />
            Alle URL'er anvender <span className="font-mono text-amber-400/80">q_auto</span> · <span className="font-mono text-amber-400/80">sp_hd</span> adaptiv HLS · 1080p loft
          </p>

          <p className="text-xs text-neutral-500">
            <span className="font-mono text-neutral-400">{video.public_id}</span>
            {video.bytes > 0 && <>{' · '}{formatBytes(video.bytes)}</>}
            {video.duration != null && <>{' · '}{Math.round(video.duration)}s</>}
            {' · '}{new Date(video.created_at).toLocaleString('da-DK')}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main VideoManager ────────────────────────────────────────────────────────

const VideoManager: React.FC = () => {
  const [videos, setVideos]   = useState<CldVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [showUpload, setShowUpload]       = useState(false);
  const [assignTarget, setAssignTarget]   = useState<CldVideo | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<CldVideo | null>(null);

  const fetchVideos = async () => {
    setLoading(true); setError(null);
    try {
      const data = await edgeFetch('');
      const list: CldVideo[] = Array.isArray(data?.resources) ? data.resources
        : Array.isArray(data) ? data : [];
      list.sort((a, b) => {
        if (isHero(a)) return -1;
        if (isHero(b)) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setVideos(list);
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke indlæse videoer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVideos(); }, []);

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    return (
      title(v).toLowerCase().includes(q) ||
      v.public_id.toLowerCase().includes(q) ||
      (v.context?.custom?.alt ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video size={22} className="text-primary" />
            <EditableContent contentKey="video-manager-title" as="span" fallback="Videobibliotek" />
          </h2>
          <p className="text-neutral-400 text-sm mt-1 flex items-center gap-1.5">
            {videos.length}{' '}
            <EditableContent contentKey="video-manager-count-label" as="span"
              fallback={videos.length !== 1 ? 'videoer i dit bibliotek' : 'video i dit bibliotek'} />
            <span className="inline-flex items-center gap-1 ml-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              <Zap size={9} /> q_auto · sp_hd · HLS
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchVideos} disabled={loading} className="p-2 bg-neutral-700 text-neutral-400 rounded-lg hover:bg-neutral-600 transition-colors" title="Opdater">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/80 transition-colors">
            <Upload size={16} />
            <EditableContent contentKey="video-manager-upload-btn" as="span" fallback="Upload video" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg efter titel, beskrivelse eller ID…"
          className="w-full bg-neutral-900/60 border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary placeholder-neutral-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-neutral-500 hover:text-white" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl p-4 text-error">
          <AlertCircle size={18} />
          <div>
            <p className="font-medium text-sm">API-fejl</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
          <button onClick={fetchVideos} className="ml-auto text-xs underline opacity-80 hover:opacity-100">
            <EditableContent contentKey="video-manager-retry-btn" as="span" fallback="Prøv igen" />
          </button>
        </div>
      )}

      {loading && !videos.length && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-neutral-700/20 border border-neutral-700 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-10 bg-neutral-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-neutral-700 rounded w-1/3" />
                  <div className="h-2 bg-neutral-700 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-neutral-500">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? 'Ingen videoer matcher din søgning' : 'Ingen videoer endnu'}</p>
          {!search && (
            <button onClick={() => setShowUpload(true)} className="mt-3 text-sm text-primary hover:underline">
              <EditableContent contentKey="video-manager-upload-first-btn" as="span" fallback="Upload din første video" />
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((video) => (
          <VideoRow
            key={video.public_id}
            video={video}
            onDeleted={(id) => setVideos((prev) => prev.filter((v) => v.public_id !== id))}
            onUpdated={(updated) => setVideos((prev) => prev.map((v) => v.public_id === updated.public_id ? updated : v))}
            onAssign={setAssignTarget}
            onReplace={setReplaceTarget}
          />
        ))}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={(v) => { setVideos((prev) => [v, ...prev]); setShowUpload(false); }}
        />
      )}
      {assignTarget && <AssignModal video={assignTarget} onClose={() => setAssignTarget(null)} />}
      {replaceTarget && (
        <ReplaceVideoModal
          video={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onReplaced={(updated) => {
            setVideos((prev) => prev.map((v) => v.public_id === updated.public_id ? updated : v));
            setReplaceTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default VideoManager;