import React, { useState } from 'react';
import { Upload, X, Settings2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import EditableContent from './EditableContent';

interface ImageUploadProps {
  onImageUploaded: (url: string, isYoutube?: boolean) => void;
  bucket?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_QUALITY   = 82;
const DEFAULT_TARGET_KB = 300;
const MIN_TARGET_KB     = 100;
const MAX_TARGET_KB     = 500;

// ─── UI helpers ───────────────────────────────────────────────────────────────
type CompressionMode = 'quality' | 'size';

function qualityLabel(q: number): string {
  if (q >= 90) return 'Høj kvalitet';
  if (q >= 70) return 'Balanceret';
  if (q >= 45) return 'Lille filstørrelse';
  return 'Maksimal komprimering';
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtKB(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)} MB` : `${kb} KB`;
}

// ─── Edge-function upload ─────────────────────────────────────────────────────
interface UploadResult {
  url: string;
  fileName: string;
  format: string;
  originalSize: number;
  compressedSize: number;
  reductionPct: number;
}

async function uploadViaEdgeFunction(
  file: File,
  bucket: string,
  mode: CompressionMode,
  quality: number,
  targetKB: number,
): Promise<UploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  // Clamp targetKB to allowed server range
  const safeTargetKB = Math.min(MAX_TARGET_KB, Math.max(MIN_TARGET_KB, targetKB));

  const form = new FormData();
  form.append('file',      file);
  form.append('bucket',    bucket);
  form.append('quality',   String(quality));
  form.append('targetKB',  String(safeTargetKB));
  // Bucket-specific dimension caps
  form.append('maxWidth',  bucket === 'rating-images' ? '1920' : '2560');
  form.append('maxHeight', bucket === 'rating-images' ? '1080' : '1440');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Upload failed');
  }

  return res.json() as Promise<UploadResult>;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUploaded,
  bucket = 'product-images',
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [youtubeUrl,       setYoutubeUrl]       = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    format?: string;
    reductionPct?: number;
  } | null>(null);

  // Settings panel
  const [showSettings,    setShowSettings]    = useState(false);
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('quality');

  // Quality mode
  const [qualityInput, setQualityInput] = useState(String(DEFAULT_QUALITY));
  const [quality,      setQuality]      = useState(DEFAULT_QUALITY);

  // Size-goal mode (100–500 KB)
  const [targetKB,      setTargetKB]      = useState(DEFAULT_TARGET_KB);
  const [targetKBInput, setTargetKBInput] = useState(String(DEFAULT_TARGET_KB));

  const commitQuality = () => {
    const v = parseInt(qualityInput, 10);
    if (!isNaN(v)) { const c = Math.min(100, Math.max(1, v)); setQuality(c); setQualityInput(String(c)); }
    else setQualityInput(String(quality));
  };

  const commitTargetKB = () => {
    const v = parseInt(targetKBInput, 10);
    if (!isNaN(v) && v > 0) {
      const kb = Math.min(MAX_TARGET_KB, Math.max(MIN_TARGET_KB, v));
      setTargetKB(kb); setTargetKBInput(String(kb));
    } else setTargetKBInput(String(targetKB));
  };

  const settingsSummary =
    compressionMode === 'quality'
      ? `${quality}% kvalitet · maks ${fmtKB(DEFAULT_TARGET_KB)} WebP`
      : `Mål: ${fmtKB(targetKB)} WebP`;

  // ─── Upload ────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type === 'video/mp4' || file.type === 'video/quicktime';
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      toast.error('Venligst upload et gyldigt billedformat (JPG, PNG, WebP, AVIF) eller video (MP4, MOV)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Filen er for stor. Maksimal størrelse er 50 MB');
      return;
    }

    try {
      setUploading(true);
      setCompressionInfo(null);

      // Immediate local preview
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      const result = await uploadViaEdgeFunction(file, bucket, compressionMode, quality, targetKB);

      if (!isVideo) {
        setCompressionInfo({
          originalSize:   result.originalSize,
          compressedSize: result.compressedSize,
          format:         result.format,
          reductionPct:   result.reductionPct,
        });
      }

      onImageUploaded(result.url);
      toast.success(
        isVideo
          ? 'Video uploadet'
          : `Billede uploadet som ${result.format} · ${fmtBytes(result.compressedSize)} (${result.reductionPct}% reduktion)`,
      );
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error(error instanceof Error ? error.message : 'Upload fejlede');
      setCompressionInfo(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  // ─── YouTube ───────────────────────────────────────────────────────────────
  const extractVideoId = (url: string): string | null => {
    const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return m && m[2].length === 11 ? m[2] : null;
  };

  const handleYoutubeSubmit = () => {
    if (!youtubeUrl) { toast.error('Please enter a YouTube URL'); return; }
    const id = extractVideoId(youtubeUrl);
    if (!id) { toast.error('Invalid YouTube URL'); return; }
    onImageUploaded(`youtube:${id}`, true);
    setYoutubeUrl(''); setShowYoutubeInput(false);
    toast.success('YouTube video added successfully');
  };

  const clearPreview = () => {
    setPreview(null); setYoutubeUrl(''); setShowYoutubeInput(false); setCompressionInfo(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative space-y-2">
      <input type="file" accept="image/*,video/mp4,video/quicktime"
        onChange={handleFileChange} className="hidden" id="image-upload" disabled={uploading} />

      {preview ? (
        <div className="relative">
          {preview.startsWith('data:video')
            ? <video src={preview} className="w-full h-48 object-cover rounded-lg" controls />
            : <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />}
          <button onClick={clearPreview}
            className="absolute top-2 right-2 p-1 bg-neutral-800 rounded-full text-white hover:bg-neutral-700 transition-colors">
            <X size={20} />
          </button>
          {compressionInfo && (
            <div className="mt-2 p-3 bg-neutral-800/80 border border-neutral-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide"><EditableContent contentKey="image-upload-komprimering" fallback="Komprimering" /></span>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                  ↓ {compressionInfo.reductionPct?.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 text-center bg-neutral-700/40 rounded p-1.5">
                  <div className="text-neutral-500 mb-0.5"><EditableContent contentKey="image-upload-original" fallback="Original" /></div>
                  <div className="text-neutral-200 font-medium">{fmtBytes(compressionInfo.originalSize)}</div>
                </div>
                <svg className="text-neutral-600 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="flex-1 text-center bg-green-900/20 border border-green-800/30 rounded p-1.5">
                  <div className="text-green-600 mb-0.5">{compressionInfo.format}</div>
                  <div className="text-green-400 font-medium">{fmtBytes(compressionInfo.compressedSize)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

      ) : showYoutubeInput ? (
        <div className="space-y-2">
          <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="Enter YouTube URL" className="form-input w-full" />
          <div className="flex justify-end space-x-2">
            <button onClick={clearPreview}
              className="px-3 py-1 text-sm bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors">
              Cancel
            </button>
            <button onClick={handleYoutubeSubmit}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors">
              Add Video
            </button>
          </div>
        </div>

      ) : (
        <>
          {/* Drop zone */}
          <label htmlFor="image-upload"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-neutral-700 rounded-lg cursor-pointer hover:border-neutral-600 transition-colors bg-neutral-800/50">
            <Upload size={24} className="text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-400">
              {uploading ? 'Komprimerer og uploader på serveren...' : 'Klik for at uploade billede eller video'}
            </p>
            <p className="text-xs text-neutral-500 mt-1"><EditableContent contentKey="image-upload-jpg-png-webp-avif-gif" fallback="JPG · PNG · WebP · AVIF · GIF op til 50 MB" /></p>
            <p className="text-xs text-neutral-500">Konverteres automatisk til WebP (100–500 KB) på serveren</p>
            {uploading && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mt-2" />}
          </label>

          <button onClick={() => setShowYoutubeInput(true)}
            className="w-full px-4 py-2 text-sm bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors">
            Add YouTube Video Instead
          </button>

          {/* Compression settings */}
          <div>
            <button type="button" onClick={() => setShowSettings(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors">
              <div className="flex items-center space-x-2">
                <Settings2 size={15} />
                <span><EditableContent contentKey="image-upload-komprimeringsindstillinger" fallback="Komprimeringsindstillinger" /></span>
              </div>
              <span className="text-xs text-neutral-500">{settingsSummary}</span>
            </button>

            {showSettings && (
              <div className="mt-2 p-3 bg-neutral-800/60 border border-neutral-700 rounded-lg space-y-4">

                {/* Mode toggle */}
                <div className="flex gap-1 p-1 bg-neutral-900/50 rounded-lg">
                  {(['quality', 'size'] as CompressionMode[]).map(m => (
                    <button key={m} type="button" onClick={() => setCompressionMode(m)}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${
                        compressionMode === m ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'
                      }`}>
                      {m === 'quality' ? 'Startkvallitet' : 'Størrelsesmål'}
                    </button>
                  ))}
                </div>

                {/* Quality mode */}
                {compressionMode === 'quality' && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Serveren starter ved denne kvalitet og reducerer automatisk, indtil filen er under {fmtKB(DEFAULT_TARGET_KB)}.
                    </p>
                    <input type="range" min={1} max={100} value={quality}
                      onChange={e => { const v = Number(e.target.value); setQuality(v); setQualityInput(String(v)); }}
                      className="w-full accent-primary" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-neutral-400 flex-1">{qualityLabel(quality)}</span>
                      <div className="flex items-center space-x-1">
                        <input type="number" min={1} max={100} value={qualityInput}
                          onChange={e => setQualityInput(e.target.value)}
                          onBlur={commitQuality} onKeyDown={e => e.key === 'Enter' && commitQuality()}
                          className="w-16 px-2 py-1 text-sm text-center bg-neutral-700 border border-neutral-600 rounded focus:outline-none focus:border-primary" />
                        <span className="text-xs text-neutral-500">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[{ label: () => Lav, value: 30 }, { label: () => Middel, value: 65 },
                        { label: () => Høj, value: 80 }, { label: () => Maks, value: 95 }].map(p => (
                        <button key={p.value} type="button"
                          onClick={() => { setQuality(p.value); setQualityInput(String(p.value)); }}
                          className={`flex-1 py-1 text-xs rounded border transition-colors ${
                            quality === p.value
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-neutral-700/40 border-neutral-600 text-neutral-400 hover:border-neutral-500 hover:text-white'
                          }`}>
                          {p.label()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size-goal mode */}
                {compressionMode === 'size' && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Vælg et størrelsesmål mellem {MIN_TARGET_KB} KB og {MAX_TARGET_KB} KB.
                      Serveren itererer automatisk til målet er opfyldt.
                    </p>
                    <div className="flex items-center gap-2">
                      <input type="number" min={MIN_TARGET_KB} max={MAX_TARGET_KB} value={targetKBInput}
                        onChange={e => setTargetKBInput(e.target.value)}
                        onBlur={commitTargetKB} onKeyDown={e => e.key === 'Enter' && commitTargetKB()}
                        className="flex-1 px-3 py-2 text-sm bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:border-primary" />
                      <span className="text-sm text-neutral-400 shrink-0">KB</span>
                    </div>
                    {/* Presets */}
                    <div className="flex gap-2">
                      {[{ label: '100 KB', kb: 100 }, { label: '200 KB', kb: 200 },
                        { label: '300 KB', kb: 300 }, { label: '500 KB', kb: 500 }].map(p => (
                        <button key={p.kb} type="button"
                          onClick={() => { setTargetKB(p.kb); setTargetKBInput(String(p.kb)); }}
                          className={`flex-1 py-1 text-xs rounded border transition-colors ${
                            targetKB === p.kb
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-neutral-700/40 border-neutral-600 text-neutral-400 hover:border-neutral-500 hover:text-white'
                          }`}>
                          {p.label()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-neutral-500 border-t border-neutral-700 pt-3">
                  Al komprimering sker på serveren. Output er altid WebP. Videoer påvirkes ikke.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageUpload;