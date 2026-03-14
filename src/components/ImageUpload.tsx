import React, { useState, useRef } from 'react';
import { Upload, X, Youtube, Images, Settings2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import EditableContent from './EditableContent';

interface ImageUploadProps {
  onImageUploaded: (url: string, isYoutube?: boolean) => void;
  onMultipleUploaded?: (urls: string[]) => void;
  currentImageUrl?: string | null;
  bucket?: string;
  allowMultiple?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_QUALITY = 82;

// ─── UI helpers ───────────────────────────────────────────────────────────────
type CompressionMode = 'quality' | 'size';

function qualityLabel(q: number): string {
  if (q >= 90) return 'Høj kvalitet';
  if (q >= 70) return 'Balanceret';
  if (q >= 45) return 'Lille filstørrelse';
  return 'Maksimal komprimering';
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024)            return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtKB(kb: number): string {
  if (kb <= 0)    return 'Ingen grænse';
  if (kb >= 1024) return `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)} MB`;
  return `${kb} KB`;
}

// ─── Edge-function upload ─────────────────────────────────────────────────────
interface UploadResult {
  url:            string;
  fileName:       string;
  format:         string;
  originalSize:   number;
  compressedSize: number;
  reductionPct:   number;
  finalQuality?:  number;
}

async function uploadViaEdgeFunction(
  file:      File,
  bucket:    string,
  quality:   number,
  targetKB:  number, // 0 = no limit
  maxWidth:  number,
  maxHeight: number,
): Promise<UploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const form = new FormData();
  form.append('file',      file);
  form.append('bucket',    bucket);
  form.append('quality',   String(quality));
  form.append('targetKB',  String(targetKB));   // 0 = no size limit
  form.append('maxWidth',  String(maxWidth));
  form.append('maxHeight', String(maxHeight));

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body:    form,
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
  onMultipleUploaded,
  currentImageUrl,
  bucket        = 'product-images',
  allowMultiple = false,
}) => {
  const [uploading,       setUploading]       = useState(false);
  const [multiUploading,  setMultiUploading]  = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState<{ done: number; total: number } | null>(null);
  const [dragOver,        setDragOver]        = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number; compressedSize: number; format: string; reductionPct: number; finalQuality?: number;
  } | null>(null);

  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl,       setYoutubeUrl]       = useState('');

  // Compression settings
  const [showSettings,    setShowSettings]    = useState(false);
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('quality');

  // Quality mode
  const [quality,      setQuality]      = useState(DEFAULT_QUALITY);
  const [qualityInput, setQualityInput] = useState(String(DEFAULT_QUALITY));

  // Size-goal mode — 0 = no limit, any positive KB value = ceiling
  const [targetKB,      setTargetKB]      = useState(0);
  const [targetKBInput, setTargetKBInput] = useState('');  // empty = no limit

  // Dimension caps (can extend in the future per bucket)
  const maxWidth  = bucket === 'rating-images' ? 1920 : 2560;
  const maxHeight = bucket === 'rating-images' ? 1080 : 1440;

  const singleRef = useRef<HTMLInputElement>(null);
  const multiRef  = useRef<HTMLInputElement>(null);

  // ─── Commit helpers ────────────────────────────────────────────────────────
  const commitQuality = () => {
    const v = parseInt(qualityInput, 10);
    if (!isNaN(v)) {
      const c = Math.min(100, Math.max(1, v));
      setQuality(c); setQualityInput(String(c));
    } else setQualityInput(String(quality));
  };

  const commitTargetKB = () => {
    const raw = targetKBInput.trim();
    if (raw === '' || raw === '0') {
      setTargetKB(0); setTargetKBInput('');
      return;
    }
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v > 0) {
      setTargetKB(v); setTargetKBInput(String(v));
    } else {
      setTargetKBInput(targetKB > 0 ? String(targetKB) : '');
    }
  };

  const effectiveTargetKB = compressionMode === 'size' ? targetKB : 0;

  const settingsSummary =
    compressionMode === 'quality'
      ? `${quality}% · ingen størrelsesgrænse`
      : effectiveTargetKB > 0
        ? `Mål: ${fmtKB(effectiveTargetKB)} · start ${quality}%`
        : `${quality}% · ingen størrelsesgrænse`;

  // ─── Single upload ─────────────────────────────────────────────────────────
  const handleSingleFile = async (file: File) => {
    const isVideo = file.type === 'video/mp4' || file.type === 'video/quicktime';
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) { toast.error('Kun billede- og videofiler er tilladt'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('Fil for stor — maks 50 MB'); return; }

    setUploading(true);
    setCompressionInfo(null);
    try {
      const result = await uploadViaEdgeFunction(file, bucket, quality, effectiveTargetKB, maxWidth, maxHeight);
      if (!isVideo) {
        setCompressionInfo({
          originalSize:   result.originalSize,
          compressedSize: result.compressedSize,
          format:         result.format,
          reductionPct:   result.reductionPct,
          finalQuality:   result.finalQuality,
        });
      }
      onImageUploaded(result.url);
      toast.success(
        isVideo
          ? 'Video uploadet'
          : `Uploadet · ${fmtBytes(result.compressedSize)} ${result.format}${result.finalQuality ? ` q${result.finalQuality}` : ''} (↓${result.reductionPct}%)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload fejlede');
      setCompressionInfo(null);
    } finally {
      setUploading(false);
      if (singleRef.current) singleRef.current.value = '';
    }
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleSingleFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSingleFile(f);
  };

  // ─── Multi upload ──────────────────────────────────────────────────────────
  const handleMultipleFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast.error('Ingen billedfiler valgt'); return; }
    if (imageFiles.length !== files.length)
      toast.error(`${files.length - imageFiles.length} fil(er) sprunget over`);

    setMultiUploading(true);
    setUploadProgress({ done: 0, total: imageFiles.length });
    const urls: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      try {
        const result = await uploadViaEdgeFunction(imageFiles[i], bucket, quality, effectiveTargetKB, maxWidth, maxHeight);
        urls.push(result.url);
        onImageUploaded(result.url);
      } catch (err) {
        console.error(`Error uploading ${imageFiles[i].name}:`, err);
        errors.push(imageFiles[i].name);
      }
      setUploadProgress({ done: i + 1, total: imageFiles.length });
    }

    if (onMultipleUploaded && urls.length > 0) onMultipleUploaded(urls);
    if (errors.length > 0) toast.error(`Kunne ikke uploade: ${errors.join(', ')}`);
    if (urls.length > 0)   toast.success(`${urls.length} billede${urls.length > 1 ? 'r' : ''} uploadet som WebP`);

    setMultiUploading(false);
    setUploadProgress(null);
    if (multiRef.current) multiRef.current.value = '';
  };

  const handleMultiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleMultipleFiles(files);
  };

  // ─── YouTube ───────────────────────────────────────────────────────────────
  const handleYoutubeSubmit = () => {
    const match = youtubeUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    );
    if (!match) { toast.error('Ugyldig YouTube URL'); return; }
    onImageUploaded(`youtube:${match[1]}`, true);
    setYoutubeUrl(''); setShowYoutubeInput(false);
    toast.success('YouTube video tilføjet');
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Current image preview */}
      {currentImageUrl && !currentImageUrl.startsWith('youtube:') && (
        <div className="relative">
          <img src={currentImageUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
          <button onClick={() => onImageUploaded('')}
            className="absolute top-2 right-2 p-1 bg-neutral-900/80 text-white rounded hover:bg-red-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {currentImageUrl?.startsWith('youtube:') && (
        <div className="relative">
          <div className="relative w-full aspect-video">
            <iframe className="absolute inset-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${currentImageUrl.split(':')[1]}`}
              title="YouTube video" frameBorder="0" allowFullScreen />
          </div>
          <button onClick={() => onImageUploaded('')}
            className="absolute top-2 right-2 p-1 bg-neutral-900/80 text-white rounded hover:bg-red-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Compression result badge */}
      {compressionInfo && (
        <div className="p-3 bg-neutral-800/80 border border-neutral-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
              <EditableContent contentKey="file-upload-komprimering" fallback="Komprimering" />
            </span>
            <div className="flex items-center gap-2">
              {compressionInfo.finalQuality && (
                <span className="text-xs text-neutral-400">q{compressionInfo.finalQuality}</span>
              )}
              <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                ↓ {compressionInfo.reductionPct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 text-center bg-neutral-700/40 rounded p-1.5">
              <div className="text-neutral-500 mb-0.5">
                <EditableContent contentKey="file-upload-original" fallback="Original" />
              </div>
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

      {/* Single drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-primary bg-primary/10' : 'border-neutral-600 hover:border-neutral-500 hover:bg-neutral-700/20'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={() => singleRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <input ref={singleRef} type="file" accept="image/*,video/mp4,video/quicktime"
          className="hidden" onChange={handleSingleChange} disabled={uploading} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="text-sm">
              <EditableContent contentKey="file-upload-komprimerer-og-uploader" fallback="Komprimerer og uploader..." />
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 text-neutral-400">
              <Upload size={18} />
              <span className="text-sm">
                <EditableContent contentKey="file-upload-klik-eller-traek" fallback="Klik eller træk et billede / video hertil" />
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              <EditableContent contentKey="file-upload-formater" fallback="JPG · PNG · WebP · AVIF · GIF · MP4 · MOV — konverteres til WebP" />
            </p>
          </div>
        )}
      </div>

      {/* Multi upload */}
      {allowMultiple && (
        <div>
          <input ref={multiRef} type="file" accept="image/*" multiple
            className="hidden" onChange={handleMultiChange} disabled={multiUploading} />
          <button type="button" onClick={() => multiRef.current?.click()} disabled={multiUploading}
            className={`w-full px-4 py-3 bg-neutral-700/30 border-2 border-dashed border-neutral-600 rounded-lg text-center hover:bg-neutral-700/50 hover:border-primary/50 transition-colors ${
              multiUploading ? 'opacity-60 pointer-events-none' : ''
            }`}>
            {multiUploading && uploadProgress ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-neutral-300">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span className="text-sm">
                    <EditableContent contentKey="file-upload-uploader" fallback="Uploader" /> {uploadProgress.done} / {uploadProgress.total}...
                  </span>
                </div>
                <div className="w-full bg-neutral-700 rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-neutral-300">
                <Images size={18} className="text-neutral-400" />
                <span className="text-sm">
                  <EditableContent contentKey="file-upload-vaelg-flere" fallback="Vælg flere billeder på én gang" />
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Compression settings */}
      <div>
        <button type="button" onClick={() => setShowSettings(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors">
          <div className="flex items-center gap-2">
            <Settings2 size={15} />
            <span>
              <EditableContent contentKey="file-upload-komprimeringsindstillinger" fallback="Komprimeringsindstillinger" />
            </span>
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
                  {m === 'quality' ? 'Kun kvalitet' : 'Størrelsesmål'}
                </button>
              ))}
            </div>

            {/* Shared quality slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {compressionMode === 'quality' ? 'WebP-kvalitet' : 'Startkvalitet'}
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} max={100} value={qualityInput}
                    onChange={e => setQualityInput(e.target.value)}
                    onBlur={commitQuality} onKeyDown={e => e.key === 'Enter' && commitQuality()}
                    className="w-14 px-2 py-0.5 text-sm text-center bg-neutral-700 border border-neutral-600 rounded focus:outline-none focus:border-primary" />
                  <span className="text-xs text-neutral-500">%</span>
                </div>
              </div>
              <input type="range" min={1} max={100} value={quality}
                onChange={e => { const v = Number(e.target.value); setQuality(v); setQualityInput(String(v)); }}
                className="w-full accent-primary" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{qualityLabel(quality)}</span>
                <div className="flex gap-1">
                  {[{ label: 'Lav', v: 30 }, { label: 'Middel', v: 65 },
                    { label: 'Høj', v: 82 }, { label: 'Maks', v: 95 }].map(p => (
                    <button key={p.v} type="button"
                      onClick={() => { setQuality(p.v); setQualityInput(String(p.v)); }}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                        quality === p.v
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-neutral-700/40 border-neutral-600 text-neutral-400 hover:border-neutral-500 hover:text-white'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Size-goal options */}
            {compressionMode === 'size' && (
              <div className="space-y-3 border-t border-neutral-700 pt-3">
                <p className="text-xs text-neutral-500">
                  Serveren reducerer kvaliteten automatisk, indtil filen er under målet.
                  Lad feltet stå tomt for ingen grænse.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Ingen grænse"
                    value={targetKBInput}
                    onChange={e => setTargetKBInput(e.target.value)}
                    onBlur={commitTargetKB}
                    onKeyDown={e => e.key === 'Enter' && commitTargetKB()}
                    className="flex-1 px-3 py-2 text-sm bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:border-primary placeholder-neutral-600"
                  />
                  <span className="text-sm text-neutral-400 shrink-0">KB</span>
                </div>
                {/* Presets */}
                <div className="flex gap-1.5">
                  {[
                    { label: 'Ingen', kb: 0 },
                    { label: '100 KB', kb: 100 },
                    { label: '300 KB', kb: 300 },
                    { label: '500 KB', kb: 500 },
                    { label: '1 MB',   kb: 1024 },
                    { label: '2 MB',   kb: 2048 },
                  ].map(p => (
                    <button key={p.kb} type="button"
                      onClick={() => {
                        setTargetKB(p.kb);
                        setTargetKBInput(p.kb > 0 ? String(p.kb) : '');
                      }}
                      className={`flex-1 py-1 text-xs rounded border transition-colors ${
                        targetKB === p.kb
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-neutral-700/40 border-neutral-600 text-neutral-400 hover:border-neutral-500 hover:text-white'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-neutral-500 border-t border-neutral-700 pt-3">
              <EditableContent contentKey="file-upload-al-komprimering-sker-paa-serveren"
                fallback="Al komprimering sker på serveren. Output er altid WebP. Videoer påvirkes ikke." />
            </p>
          </div>
        )}
      </div>

      {/* YouTube */}
      <div>
        {!showYoutubeInput ? (
          <button type="button" onClick={() => setShowYoutubeInput(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors">
            <Youtube size={16} />
            <span>
              <EditableContent contentKey="file-upload-tilfoej-youtube" fallback="Tilføj YouTube video i stedet" />
            </span>
          </button>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleYoutubeSubmit()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="form-input flex-1 text-sm" autoFocus />
            <button type="button" onClick={handleYoutubeSubmit}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm">
              <EditableContent contentKey="file-upload-tilfoej" fallback="Tilføj" />
            </button>
            <button type="button" onClick={() => { setShowYoutubeInput(false); setYoutubeUrl(''); }}
              className="p-2 text-neutral-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default ImageUpload;
