/**
 * heroPreload.ts
 *
 * ─── Root cause of all 404 errors ────────────────────────────────────────────
 *
 * This Cloudinary account was created after June 4, 2024 and therefore uses
 * DYNAMIC FOLDER MODE. In dynamic folder mode, the asset_folder ('Herovideo')
 * is completely decoupled from the public_id and the delivery URL.
 *
 * Uploading with:
 *   asset_folder = 'Herovideo'
 *   public_id    = 'herovideo'
 *
 * Results in an upload response with:
 *   public_id = 'herovideo'   ← NOT 'Herovideo/herovideo'
 *
 * The delivery URL is therefore:
 *   https://res.cloudinary.com/dq6jxbyrg/video/upload/...herovideo.m3u8
 *                                                                ↑ no folder prefix
 *
 * Previous code assumed fixed folder mode behaviour where the folder is
 * prepended to the public_id. That assumption was wrong and caused every
 * single delivery URL to 404.
 *
 * ─── Additional URL bugs fixed ───────────────────────────────────────────────
 *
 * BUG 2 — dl_auto is not a valid Cloudinary transformation → 400 on MP4 URL
 *   Fixed: MP4 URL uses vc_h264/f_mp4/q_auto:good — explicit and valid.
 *
 * BUG 3 — sp_auto chains q_auto → invalid, sp_auto controls quality internally
 *   Fixed: HLS URL is just sp_auto/<publicId>.m3u8, no extra params.
 *
 * BUG 4 — Poster used f_auto/.webp → 404 until eager processing completes
 *   f_auto/.webp requires a derived asset to already exist. JPEG frames are
 *   synchronously derived from any source format on first request.
 *   Fixed: poster uses f_jpg — always available immediately after upload.
 *
 * BUG 5 — dpr_auto on poster doubles derived asset count needlessly
 *   Removed — responsive srcset with 480w/960w/1920w already handles DPR.
 *
 * ─── Cloudinary URL rules ─────────────────────────────────────────────────────
 * • sp_auto for delivery — works on first request, no pre-generation needed.
 * • sp_hd for eager presets only — requires pre-generation to be complete.
 * • Do NOT chain q_auto after sp_auto — sp_auto controls quality internally.
 * • f_auto is INCOMPATIBLE with sp_auto (sp_auto handles format internally).
 * • Poster frames: use f_jpg — synchronously available, no 404 risk.
 */

const CLOUD = 'dq6jxbyrg'

// Public ID of the hero video.
//
// IMPORTANT — DYNAMIC FOLDER MODE:
// This account uses dynamic folder mode (Cloudinary default since June 2024).
// In this mode, asset_folder ('Herovideo') is display-only and is NOT part of
// the public_id or the delivery URL. The public_id returned by the upload API
// is just 'herovideo' — confirmed by the Cloudinary Media Library UI which
// shows Public ID: herovideo (without any folder prefix).
const HERO_PUBLIC_ID = 'herovideo'

export interface HeroVideo {
  public_id: string
  hlsUrl:    string
  posterUrl: string
}

// ─── URL builders — single source of truth ────────────────────────────────────
// ALL files (VideoManager, HeroVideoSection, bustHeroCache) import from here.
// Preloaded URLs and runtime URLs are always identical → guaranteed cache hit.

export function cloudinaryHlsUrl(publicId: string): string {
  // sp_auto + .m3u8 — generates adaptive HLS on-demand at the CDN edge.
  // Works on first request without any eager pre-generation.
  // Do NOT chain q_auto after sp_auto — sp_auto controls quality internally.
  return `https://res.cloudinary.com/${CLOUD}/video/upload/sp_auto/${publicId}.m3u8`
}

export function cloudinaryMp4Url(publicId: string): string {
  // vc_h264/f_mp4/q_auto:good — explicit codec + container + quality.
  // dl_auto was invalid and caused 400 errors.
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_h264/f_mp4/q_auto:good/${publicId}.mp4`
}

export function cloudinaryWebmUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_vp9/f_webm/q_auto:good/${publicId}.webm`
}

export function cloudinaryPosterUrl(
  publicId: string,
  width    = 1920,
  quality  = 'good',
): string {
  // f_jpg — JPEG poster frames are derived synchronously on first request from
  // any source format (MOV, MP4, etc.) without needing eager pre-generation.
  // f_auto/.webp caused 404s until Cloudinary finished async eager processing.
  // dpr_auto removed — responsive srcset (480w/960w/1920w) already handles DPR.
  return (
    `https://res.cloudinary.com/${CLOUD}/video/upload/` +
    `c_fill,g_auto,w_${width},so_0/f_jpg/q_auto:${quality}/${publicId}.jpg`
  )
}

// ─── Mutable singleton ────────────────────────────────────────────────────────
// Mutable so bustHeroCache() can update it in-place after a new upload.
// HeroVideoSection reads this via getHeroVideo() on mount.

const heroVideo: HeroVideo = {
  public_id: HERO_PUBLIC_ID,
  hlsUrl:    cloudinaryHlsUrl(HERO_PUBLIC_ID),
  posterUrl: cloudinaryPosterUrl(HERO_PUBLIC_ID, 1920, 'good'),
}

export function getHeroVideo(): HeroVideo            { return heroVideo }
export function fetchHeroVideo(): Promise<HeroVideo> { return Promise.resolve(heroVideo) }

// ─── Preload hints ────────────────────────────────────────────────────────────
// heroPreload.ts is imported ONLY by HomePage.tsx — so these DOM mutations
// never run on /products, /admin, or any other route. Homepage only.

function injectConnectionHints(): void {
  if (typeof document === 'undefined') return
  const head   = document.head
  const origin = 'https://res.cloudinary.com'

  if (!head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
    const pc = document.createElement('link')
    pc.rel = 'preconnect'; pc.href = origin; pc.crossOrigin = 'anonymous'
    head.prepend(pc)
  }
  if (!head.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {
    const dp = document.createElement('link')
    dp.rel = 'dns-prefetch'; dp.href = origin
    head.prepend(dp)
  }
}

export function injectPreloadHints(publicId = heroVideo.public_id): void {
  if (typeof document === 'undefined') return
  const head = document.head

  // Remove stale slot tags — no-op on first call, required after a bust
  head.querySelectorAll('link[data-hero-slot]').forEach(el => el.remove())

  const frag = document.createDocumentFragment()

  // HLS manifest — crossOrigin property (not setAttribute) ensures CORS mode
  // matches hls.js fetch() call → guaranteed cache hit, not a miss.
  const hlsLink = document.createElement('link')
  hlsLink.rel = 'preload'; hlsLink.as = 'fetch'
  hlsLink.href = cloudinaryHlsUrl(publicId)
  hlsLink.crossOrigin = 'anonymous'
  ;(hlsLink as any).fetchPriority = 'high'
  hlsLink.dataset.heroSlot = 'hls'
  frag.appendChild(hlsLink)

  // Poster — responsive srcset using .jpg (always available immediately).
  // href is the 1920w entry so on full-width (sizes="100vw") viewports the
  // browser picks this entry and the preload is always consumed — eliminating
  // the "preloaded but not used" warning.
  const posterLink = document.createElement('link')
  posterLink.rel = 'preload'; posterLink.as = 'image'
  posterLink.href = cloudinaryPosterUrl(publicId, 1920, 'good')
  ;(posterLink as any).imageSrcset = [
    `${cloudinaryPosterUrl(publicId,  480, 'eco')} 480w`,
    `${cloudinaryPosterUrl(publicId,  960, 'eco')} 960w`,
    `${cloudinaryPosterUrl(publicId, 1920, 'good')} 1920w`,
  ].join(', ')
  ;(posterLink as any).imageSizes = '100vw'
  ;(posterLink as any).fetchPriority = 'high'
  posterLink.dataset.heroSlot = 'poster'
  frag.appendChild(posterLink)

  head.prepend(frag)
}

// ─── Cache busting ────────────────────────────────────────────────────────────

/**
 * bustHeroCache(publicId)
 *
 * Called by VideoManager after a successful upload/replace, with the
 * public_id returned directly from the Cloudinary upload API response.
 *
 * IMPORTANT: In dynamic folder mode the upload response returns the bare
 * public_id WITHOUT any folder prefix. Always pass result.public_id from
 * the upload response directly — never construct it manually by combining
 * asset_folder + public_id, as that produces the wrong value.
 */
export function bustHeroCache(publicId: string = HERO_PUBLIC_ID): void {
  if (typeof window === 'undefined') return

  const run = () => {
    const opts: RequestInit = { method: 'GET', cache: 'reload', credentials: 'omit' }

    Promise.allSettled([
      fetch(cloudinaryHlsUrl(publicId),                  opts),
      fetch(cloudinaryPosterUrl(publicId,  480, 'eco'),  opts),
      fetch(cloudinaryPosterUrl(publicId,  960, 'eco'),  opts),
      fetch(cloudinaryPosterUrl(publicId, 1920, 'good'), opts),
      fetch(new Request(cloudinaryMp4Url(publicId), {
        ...opts,
        headers: { Range: 'bytes=0-0' },
      })),
    ]).then(() => {
      heroVideo.public_id = publicId
      heroVideo.hlsUrl    = cloudinaryHlsUrl(publicId)
      heroVideo.posterUrl = cloudinaryPosterUrl(publicId, 1920, 'good')

      injectPreloadHints(publicId)

      window.dispatchEvent(
        new CustomEvent('heroVideoChanged', { detail: { publicId } })
      )
    }).catch(() => { /* non-fatal — CDN TTL handles it */ })
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 2000)
  }
}

// ─── Module init ──────────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  injectConnectionHints()
  injectPreloadHints()
}
