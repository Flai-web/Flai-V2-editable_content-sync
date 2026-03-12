/**
 * heroPreload.ts
 *
 * Imported ONLY by HeroVideoSection — not main.tsx.
 * Only fires on the homepage, never on other routes.
 *
 * ─── Cloudinary URL rules (from official docs) ────────────────────────────────
 * 1. f_auto and q_auto MUST be separate chained components (/), never comma-separated.
 *    WRONG:  f_auto,q_auto   ← treated as one component, CDN cannot see f_auto
 *    RIGHT:  f_auto/q_auto   ← chained, CDN intercepts f_auto and picks format per browser
 *
 * 2. f_auto is INCOMPATIBLE with sp_auto for HLS.
 *    sp_auto handles codec/format selection internally. Adding f_auto breaks it.
 *
 * 3. f_auto in eager transformations has no effect (no browser present at transcode time).
 *    Eager must use explicit formats.
 *
 * ─── Speed features used ──────────────────────────────────────────────────────
 * HLS:  sp_auto        — auto-selects CMAF/HLS profile + codec (H.265 on Safari, VP9/AV1 on Chrome)
 *       q_auto:good    — best quality/size ratio
 *
 * MP4:  vc_auto        — best codec per browser (H.265, VP9, AV1 where supported)
 *       f_auto         — WebM/MP4 container selection per browser
 *       q_auto:good    — best quality/size ratio
 *       dl_auto        — CDN streaming delivery optimisation (progressive download w/ byte-range)
 *
 * Poster: c_fill,g_auto — smart crop to fill frame
 *         w_{n},dpr_auto — correct pixel density (2x on retina, 1x otherwise)
 *         so_0           — first frame, so poster matches video start exactly
 *         f_auto         — WebP on Chrome/Edge, AVIF where supported, JPEG fallback
 *         q_auto         — perceptual quality optimisation
 *
 * ─── Cache busting ────────────────────────────────────────────────────────────
 * bustHeroCache() is called by VideoManager after a new hero video is uploaded.
 * It uses fetch(..., { cache: 'reload' }) to tell the browser to bypass its HTTP
 * cache and re-fetch fresh bytes from Cloudinary's CDN — then removes and
 * re-injects the <link rel="preload"> tags so future navigations get the new asset.
 *
 * ALL of this runs inside requestIdleCallback so it never competes with any
 * ongoing paint, layout or user interaction. On browsers without rIC it falls
 * back to a 2 s setTimeout — still fully off the critical rendering path.
 */

const CLOUD          = 'dq6jxbyrg'
const HERO_PUBLIC_ID = 'herovideo'

export interface HeroVideo {
  public_id: string
  hlsUrl:    string
  posterUrl: string
}

// ─── URL builders ─────────────────────────────────────────────────────────────

export function cloudinaryHlsUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/sp_auto/q_auto:good/${publicId}.m3u8`
}

export function cloudinaryMp4Url(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_auto/f_auto/q_auto:good/${publicId}.mp4`
}

export function cloudinaryPosterUrl(publicId: string, width = 1920): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/c_fill,g_auto,w_${width},dpr_auto,so_0/f_auto/q_auto/${publicId}.webp`
}

// ─── Preload hints ────────────────────────────────────────────────────────────

function injectPreloadHints(publicId = HERO_PUBLIC_ID): void {
  if (typeof document === 'undefined') return
  const head = document.head

  const ensureOnce = (attrs: Record<string, string>) => {
    const sel = Object.entries(attrs)
      .map(([k, v]) => `[${k}="${CSS.escape(v)}"]`).join('')
    if (head.querySelector(`link${sel}`)) return
    const el = document.createElement('link')
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    head.prepend(el)
  }

  // Preconnect + dns-prefetch — injected once, shared across all publicIds
  ensureOnce({ rel: 'preconnect', href: 'https://res.cloudinary.com', crossorigin: 'anonymous' })
  ensureOnce({ rel: 'dns-prefetch', href: 'https://res.cloudinary.com' })

  // Helper: remove stale tag if href changed, then inject fresh one
  const upsert = (attrs: Record<string, string>, slot: string) => {
    const existing = head.querySelector(`link[data-hero-slot="${slot}"]`)
    if (existing && existing.getAttribute('href') === attrs.href) return // unchanged
    existing?.remove()
    const el = document.createElement('link')
    Object.entries({ ...attrs, 'data-hero-slot': slot }).forEach(([k, v]) => el.setAttribute(k, v))
    head.prepend(el)
  }

  // HLS manifest
  upsert({
    rel:           'preload',
    as:            'fetch',
    href:          cloudinaryHlsUrl(publicId),
    crossorigin:   'anonymous',
    fetchpriority: 'high',
  } as Record<string, string>, 'hls')

  // Poster (responsive srcset)
  upsert({
    rel:           'preload',
    as:            'image',
    href:          cloudinaryPosterUrl(publicId, 1920),
    imagesrcset:   [
      `${cloudinaryPosterUrl(publicId, 480)} 480w`,
      `${cloudinaryPosterUrl(publicId, 960)} 960w`,
      `${cloudinaryPosterUrl(publicId, 1920)} 1920w`,
    ].join(', '),
    imagesizes:    '100vw',
    fetchpriority: 'high',
  } as Record<string, string>, 'poster')
}

// ─── Cache busting ────────────────────────────────────────────────────────────

/**
 * bustHeroCache(publicId?)
 *
 * Called by VideoManager immediately after a hero video upload/replace.
 * Runs 100% off the critical path — inside requestIdleCallback (rIC) with a
 * 5 s deadline, or a 2 s setTimeout fallback on browsers without rIC.
 *
 * Mechanism:
 *  1. fetch(..., { cache: 'reload', mode: 'no-cors' }) for the HLS manifest
 *     and all poster breakpoints — bypasses the browser HTTP cache and stores
 *     the fresh CDN response. Next time HeroVideoSection renders (or the user
 *     navigates back to the home page) the browser finds the new bytes already
 *     warm in cache.
 *  2. HEAD-only for the MP4 URL — updates cache metadata without re-downloading
 *     the entire video file.
 *  3. After all fetches settle, removes stale <link rel="preload"> tags and
 *     injects fresh ones — so the next navigation preloads the correct asset.
 *
 * Loading-speed guarantees:
 *  • rIC scheduling — browser only runs this when the main thread is idle.
 *  • Promise.allSettled — a CDN miss on one URL never blocks the others.
 *  • no-cors mode — eliminates CORS preflight round-trips on media URLs.
 *  • Errors silently swallowed — bust failure is non-fatal; CDN TTL handles it.
 */
export function bustHeroCache(publicId = HERO_PUBLIC_ID): void {
  if (typeof window === 'undefined') return

  const run = () => {
    Promise.allSettled([
      // HLS manifest — small text payload, GET is correct
      fetch(cloudinaryHlsUrl(publicId), {
        method: 'GET', cache: 'reload', mode: 'no-cors', credentials: 'omit',
      }),
      // Poster at every breakpoint HeroVideoSection uses
      fetch(cloudinaryPosterUrl(publicId, 480),  {
        method: 'GET', cache: 'reload', mode: 'no-cors', credentials: 'omit',
      }),
      fetch(cloudinaryPosterUrl(publicId, 960),  {
        method: 'GET', cache: 'reload', mode: 'no-cors', credentials: 'omit',
      }),
      fetch(cloudinaryPosterUrl(publicId, 1920), {
        method: 'GET', cache: 'reload', mode: 'no-cors', credentials: 'omit',
      }),
      // MP4 — HEAD only: refreshes cache metadata, skips downloading video bytes
      fetch(cloudinaryMp4Url(publicId), {
        method: 'HEAD', cache: 'reload', mode: 'no-cors', credentials: 'omit',
      }),
    ]).then(() => {
      // Refresh <link rel="preload"> tags so next navigation preloads new content
      injectPreloadHints(publicId)
    }).catch(() => { /* non-fatal */ })
  }

  // Schedule in idle time — zero competition with render / interaction
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 2000) // Safari / older browsers
  }
}

// ─── Module init ──────────────────────────────────────────────────────────────

const heroVideo: HeroVideo = {
  public_id: HERO_PUBLIC_ID,
  hlsUrl:    cloudinaryHlsUrl(HERO_PUBLIC_ID),
  posterUrl: cloudinaryPosterUrl(HERO_PUBLIC_ID, 1920),
}

injectPreloadHints()

export function getHeroVideo(): HeroVideo { return heroVideo }
export function fetchHeroVideo(): Promise<HeroVideo> { return Promise.resolve(heroVideo) }