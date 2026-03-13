/**
 * heroPreload.ts
 *
 * Imported ONLY by HomePage (via `import '../utils/heroPreload'`).
 * Never runs on other routes — no wasted preloads/fetches on /products etc.
 *
 * ─── Speed architecture ───────────────────────────────────────────────────────
 *
 * T+0ms  index.html inline script fires synchronously during HTML parsing.
 *        It checks window.location.pathname === '/' and — only then — injects
 *        the preconnect + poster preload + HLS manifest preload into <head>.
 *        These fetches queue BEFORE the JS bundle is even downloaded.
 *        window.__HERO_PUBLIC_ID is set to the current publicId.
 *
 * T+?ms  heroPreload.ts module is imported by HomePage's lazy chunk.
 *        It reads __HERO_PUBLIC_ID so URL builders use the same id the
 *        inline script already preloaded — guaranteed cache hit for hls.js.
 *
 * ─── After bustHeroCache() ────────────────────────────────────────────────────
 *
 * When VideoManager uploads a new hero video it calls bustHeroCache(newId).
 * The sequence:
 *   1. Re-fetch all assets with { cache: 'reload' } — warms HTTP cache with
 *      new bytes.
 *   2. Update window.__HERO_PUBLIC_ID to newId.
 *   3. Refresh the <link data-hero-slot> tags so a soft-navigation back to '/'
 *      gets the new preload URL instantly (no full-page reload needed).
 *   4. Dispatch 'heroVideoChanged' event — HeroVideoSection listens and
 *      reinitialises its HLS source so the new video plays immediately,
 *      without waiting for a page reload.
 *
 * ─── Cloudinary URL rules ─────────────────────────────────────────────────────
 * • f_auto and q_auto MUST be separate chained /-components, never commas.
 * • f_auto is INCOMPATIBLE with sp_auto (sp_auto handles format internally).
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
  // dl_auto: byte-range adaptive delivery — faster TTFB for first segment
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_auto/f_auto/q_auto:good/dl_auto/${publicId}.mp4`
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

// ─── Active public ID ─────────────────────────────────────────────────────────
// Read from the inline script's window global so URL builders always match
// what was already preloaded — guarantees a cache hit for hls.js.

function getActivePublicId(): string {
  if (typeof window !== 'undefined' && (window as any).__HERO_PUBLIC_ID) {
    return (window as any).__HERO_PUBLIC_ID as string
  }
  return HERO_PUBLIC_ID
}

// ─── Preload tag refresh ──────────────────────────────────────────────────────
// Called after a cache bust to update the <link data-hero-slot> tags that the
// inline script injected. This means soft-navigation back to '/' picks up the
// new asset immediately — no full-page reload needed.

function refreshPreloadTags(publicId: string): void {
  if (typeof document === 'undefined') return

  // Only refresh if the inline script actually ran (i.e. we're on '/')
  const existing = document.head.querySelectorAll('link[data-hero-slot]')
  if (!existing.length) return

  existing.forEach(el => el.remove())

  const frag = document.createDocumentFragment()

  const posterLink                  = document.createElement('link')
  posterLink.rel                    = 'preload'
  posterLink.as                     = 'image'
  posterLink.href                   = cloudinaryPosterUrl(publicId, 1920, 'good')
  ;(posterLink as any).imageSrcset  = [
    `${cloudinaryPosterUrl(publicId,  480, 'eco')} 480w`,
    `${cloudinaryPosterUrl(publicId,  960, 'eco')} 960w`,
    `${cloudinaryPosterUrl(publicId, 1920, 'good')} 1920w`,
  ].join(', ')
  ;(posterLink as any).imageSizes   = '100vw'
  ;(posterLink as any).fetchPriority = 'high'
  posterLink.dataset.heroSlot       = 'poster'
  frag.appendChild(posterLink)

  const hlsLink              = document.createElement('link')
  hlsLink.rel                = 'preload'
  hlsLink.as                 = 'fetch'
  hlsLink.href               = cloudinaryHlsUrl(publicId)
  hlsLink.crossOrigin        = 'anonymous'
  ;(hlsLink as any).fetchPriority = 'high'
  hlsLink.dataset.heroSlot   = 'hls'
  frag.appendChild(hlsLink)

  document.head.prepend(frag)
}

// ─── Cache busting ────────────────────────────────────────────────────────────

/**
 * bustHeroCache(publicId?)
 *
 * Called by VideoManager immediately after a hero video upload/replace.
 * Runs inside requestIdleCallback — zero competition with paint or interaction.
 *
 * Fixes the "video doesn't play after cache bust" bug:
 *   After the HTTP cache is warmed, this dispatches a 'heroVideoChanged' event
 *   with the new publicId. HeroVideoSection listens for this event and
 *   reinitialises its HLS source immediately — no page reload required.
 *
 * Key rules:
 *   NO mode:'no-cors' — opaque responses are NOT written to HTTP cache.
 *   MP4: Range:bytes=0-0 — 1-byte fetch refreshes cache entry cheaply.
 *   Promise.allSettled — one CDN miss never blocks the others.
 */
export function bustHeroCache(publicId = HERO_PUBLIC_ID): void {
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
      // 1. Update the global so getActivePublicId() returns the new id
      ;(window as any).__HERO_PUBLIC_ID = publicId

      // 2. Refresh <link> tags for the next soft-navigation to '/'
      refreshPreloadTags(publicId)

      // 3. Tell HeroVideoSection to reinitialise NOW — fixes the "no play after
      //    bust" bug. The component tears down its HLS instance and starts fresh
      //    with the new publicId, so the new video plays without a page reload.
      window.dispatchEvent(new CustomEvent('heroVideoChanged', { detail: { publicId } }))
    }).catch(() => { /* non-fatal */ })
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 2000) // Safari
  }
}

// ─── Module singleton ─────────────────────────────────────────────────────────
// Built from the active publicId so URL builders always match the preloaded asset.

const _id = getActivePublicId()

const heroVideo: HeroVideo = {
  public_id: _id,
  hlsUrl:    cloudinaryHlsUrl(_id),
  posterUrl: cloudinaryPosterUrl(_id, 1920, 'good'),
}

export function getHeroVideo(): HeroVideo           { return heroVideo }
export function fetchHeroVideo(): Promise<HeroVideo> { return Promise.resolve(heroVideo) }
