/**
 * heroPreload.ts
 *
 * ─── Bugs fixed ───────────────────────────────────────────────────────────────
 *
 * BUG 1 — Wrong public_id → video never played
 *   Cloudinary prepends the asset_folder to the public_id on upload.
 *   Uploading to asset_folder='Herovideo' with id='herovideo' produces
 *   result.public_id = 'Herovideo/herovideo', not 'herovideo'.
 *   Every URL was wrong. Fixed: default is now 'Herovideo/herovideo'.
 *
 * BUG 2 — URL mismatch between VideoManager and heroPreload → cache miss
 *   VideoManager had its own private URL builders (sp_hd/f_m3u8, f_jpg).
 *   heroPreload used different ones (sp_auto/q_auto:good, f_auto/.webp).
 *   hls.js fetched the manifest at a URL that was never preloaded → miss.
 *   Fixed: VideoManager now imports all builders from here. One source of truth.
 *
 * BUG 3 — Frozen singleton → cache bust never updated the playing video
 *   getHeroVideo() returned a frozen module-level object. bustHeroCache(newId)
 *   had no way to update it, so HeroVideoSection kept the old URL forever.
 *   Fixed: singleton is mutable. bustHeroCache() mutates it, then dispatches
 *   'heroVideoChanged' so HeroVideoSection reloads with the new source.
 *
 * ─── Cloudinary URL rules ─────────────────────────────────────────────────────
 * • f_auto and q_auto MUST be separate chained /-components, never commas.
 * • f_auto is INCOMPATIBLE with sp_auto (sp_auto handles format internally).
 */

const CLOUD = 'dq6jxbyrg'

// Full Cloudinary public_id including folder.
// Matches result.public_id from uploading to asset_folder='Herovideo'.
const HERO_PUBLIC_ID = 'Herovideo/herovideo'

export interface HeroVideo {
  public_id: string
  hlsUrl:    string
  posterUrl: string
}

// ─── URL builders — single source of truth ────────────────────────────────────
// ALL files (VideoManager, HeroVideoSection, bustHeroCache) import from here.
// Preloaded URLs and runtime URLs are always identical → guaranteed cache hit.

export function cloudinaryHlsUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/sp_auto/q_auto:good/${publicId}.m3u8`
}

export function cloudinaryMp4Url(publicId: string): string {
  // dl_auto: byte-range adaptive delivery — faster TTFB for first segment
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_auto/f_auto/q_auto:good/dl_auto/${publicId}.mp4`
}

export function cloudinaryWebmUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_vp9/f_auto/q_auto:good/${publicId}.webm`
}

export function cloudinaryPosterUrl(
  publicId: string,
  width    = 1920,
  quality  = 'good',
): string {
  return (
    `https://res.cloudinary.com/${CLOUD}/video/upload/` +
    `c_fill,g_auto,w_${width},dpr_auto,so_0/f_auto/q_auto:${quality}/${publicId}.webp`
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

export function getHeroVideo(): HeroVideo           { return heroVideo }
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
  // matches hls.js fetch() call → guaranteed cache hit, not a miss
  const hlsLink = document.createElement('link')
  hlsLink.rel = 'preload'; hlsLink.as = 'fetch'
  hlsLink.href = cloudinaryHlsUrl(publicId)
  hlsLink.crossOrigin = 'anonymous'
  ;(hlsLink as any).fetchPriority = 'high'
  hlsLink.dataset.heroSlot = 'hls'
  frag.appendChild(hlsLink)

  // Poster — responsive srcset, q_auto:eco for small breakpoints
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
 * Called by VideoManager with result.public_id from Cloudinary after upload.
 * Runs in requestIdleCallback — zero competition with paint or interaction.
 *
 * Sequence:
 *  1. Re-fetch all assets with { cache:'reload' } — no mode:'no-cors' so the
 *     browser actually writes the new bytes back to HTTP cache.
 *  2. Mutate the singleton so getHeroVideo() returns the new publicId.
 *  3. Refresh preload tags so the next homepage visit preloads the right asset.
 *  4. Dispatch 'heroVideoChanged' — HeroVideoSection tears down its HLS
 *     instance and starts a fresh one with the new publicId immediately.
 *     No page reload needed.
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
      // 1-byte range — refreshes the MP4 cache entry without downloading the file
      fetch(new Request(cloudinaryMp4Url(publicId), {
        ...opts,
        headers: { Range: 'bytes=0-0' },
      })),
    ]).then(() => {
      // Mutate singleton — HeroVideoSection reads this on next render
      heroVideo.public_id = publicId
      heroVideo.hlsUrl    = cloudinaryHlsUrl(publicId)
      heroVideo.posterUrl = cloudinaryPosterUrl(publicId, 1920, 'good')

      // Refresh preload tags for next navigation to '/'
      injectPreloadHints(publicId)

      // Tell the currently-mounted HeroVideoSection to reload now
      window.dispatchEvent(
        new CustomEvent('heroVideoChanged', { detail: { publicId } })
      )
    }).catch(() => { /* non-fatal — CDN TTL handles it */ })
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 2000) // Safari fallback
  }
}

// ─── Module init ──────────────────────────────────────────────────────────────
// Fires synchronously when HomePage.tsx imports this module.
// Never runs on other routes — heroPreload is only imported by HomePage.

if (typeof document !== 'undefined') {
  injectConnectionHints() // TLS handshake to Cloudinary starts immediately
  injectPreloadHints()    // poster + HLS manifest queued at fetchpriority=high
}
