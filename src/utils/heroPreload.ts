/**
 * heroPreload.ts
 *
 * ─── Dynamic folder mode ──────────────────────────────────────────────────────
 * Account created after June 2024 → dynamic folder mode.
 * asset_folder ('Herovideo') is display-only. The upload API returns a bare
 * public_id ('herovideo') with NO folder prefix. Delivery URLs use bare id.
 *
 * ─── Performance: MP4 first, HLS as enhancement ───────────────────────────────
 * sp_auto generates the HLS manifest on first request (on-demand transcoding).
 * For a 33 MB MOV this means the browser stalls waiting for Cloudinary to
 * transcode before even the first segment can be fetched — causing slow starts.
 *
 * Fix: treat MP4 as the primary source and load HLS only as a progressive
 * enhancement once we know the manifest is available. The MP4 is derived
 * synchronously and plays immediately. HLS.js is still used where supported
 * because it gives adaptive bitrate, but we fall back to MP4 instantly if the
 * manifest is not ready (404/error on first load).
 *
 * ─── Poster cache busting ─────────────────────────────────────────────────────
 * The browser has two separate caches for images:
 *   1. HTTP cache  — controlled by Cache-Control headers
 *   2. Decoded image memory cache — keyed on the exact src URL string
 *
 * fetch({ cache: 'reload' }) only refreshes the HTTP cache. The <img> element
 * continues reading from the decoded image memory cache if the src URL is
 * unchanged — so the old poster stays visible even after the fetch completes.
 *
 * Fix: bustHeroCache stores a numeric version stamp in sessionStorage and
 * appends ?v=<stamp> to all poster URLs. Since HeroVideoSection reads the
 * stamp from the exported getter, its <img> src changes → forces a new
 * HTTP request → bypasses the decoded image cache entirely.
 */

const CLOUD = 'dq6jxbyrg'

// Bare public_id — dynamic folder mode, no folder prefix in delivery URL.
const HERO_PUBLIC_ID = 'herovideo'

// ─── Cache-bust version stamp ─────────────────────────────────────────────────
// Persisted across module re-imports via sessionStorage (survives soft-nav,
// cleared on tab close). bustHeroCache() increments this so <img> src URLs
// change and the browser is forced to re-fetch the poster from the CDN.

const STAMP_KEY = 'hero_poster_v'

function readStamp(): number {
  try { return parseInt(sessionStorage.getItem(STAMP_KEY) ?? '0', 10) || 0 }
  catch { return 0 }
}

function writeStamp(v: number): void {
  try { sessionStorage.setItem(STAMP_KEY, String(v)) } catch {}
}

let _posterStamp = readStamp()

/** Returns the current poster cache-bust stamp. HeroVideoSection reads this. */
export function getPosterStamp(): number { return _posterStamp }

export interface HeroVideo {
  public_id:   string
  hlsUrl:      string
  mp4Url:      string
  posterUrl:   string
  posterStamp: number
}

// ─── URL builders — single source of truth ────────────────────────────────────

export function cloudinaryHlsUrl(publicId: string): string {
  // sp_auto: on-demand HLS manifest generation. Used as progressive enhancement
  // after the MP4 has already started playing.
  return `https://res.cloudinary.com/${CLOUD}/video/upload/sp_auto/${publicId}.m3u8`
}

export function cloudinaryMp4Url(publicId: string): string {
  // Primary video source — derived synchronously, plays immediately.
  // vc_h264/f_mp4/q_auto:good: explicit codec+container to avoid ambiguity.
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_h264/f_mp4/q_auto:good/${publicId}.mp4`
}

export function cloudinaryWebmUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD}/video/upload/vc_vp9/f_webm/q_auto:good/${publicId}.webm`
}

export function cloudinaryPosterUrl(
  publicId: string,
  width    = 1920,
  quality  = 'good',
  stamp    = 0,
): string {
  // f_jpg — always derived synchronously from any source format, no 404 risk.
  // ?v=stamp appended when stamp > 0 to bust the browser's decoded image cache.
  const base =
    `https://res.cloudinary.com/${CLOUD}/video/upload/` +
    `c_fill,g_auto,w_${width},so_0/f_jpg/q_auto:${quality}/${publicId}.jpg`
  return stamp > 0 ? `${base}?v=${stamp}` : base
}

// ─── Mutable singleton ────────────────────────────────────────────────────────

const heroVideo: HeroVideo = {
  public_id:   HERO_PUBLIC_ID,
  hlsUrl:      cloudinaryHlsUrl(HERO_PUBLIC_ID),
  mp4Url:      cloudinaryMp4Url(HERO_PUBLIC_ID),
  posterUrl:   cloudinaryPosterUrl(HERO_PUBLIC_ID, 1920, 'good', _posterStamp),
  posterStamp: _posterStamp,
}

export function getHeroVideo(): HeroVideo            { return heroVideo }
export function fetchHeroVideo(): Promise<HeroVideo> { return Promise.resolve(heroVideo) }

// ─── Preload hints ────────────────────────────────────────────────────────────

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

export function injectPreloadHints(publicId = heroVideo.public_id, stamp = _posterStamp): void {
  if (typeof document === 'undefined') return
  const head = document.head

  head.querySelectorAll('link[data-hero-slot]').forEach(el => el.remove())

  const frag = document.createDocumentFragment()

  // MP4 is now the primary source — preload it at high priority so the browser
  // starts buffering before React even renders HeroVideoSection.
  const mp4Link = document.createElement('link')
  mp4Link.rel = 'preload'; mp4Link.as = 'video'
  mp4Link.href = cloudinaryMp4Url(publicId)
  ;(mp4Link as any).fetchPriority = 'high'
  mp4Link.dataset.heroSlot = 'mp4'
  frag.appendChild(mp4Link)

  // Poster — uses stamp so the preload URL always matches the <img> src URL.
  const posterLink = document.createElement('link')
  posterLink.rel = 'preload'; posterLink.as = 'image'
  posterLink.href = cloudinaryPosterUrl(publicId, 1920, 'good', stamp)
  ;(posterLink as any).imageSrcset = [
    `${cloudinaryPosterUrl(publicId,  480, 'eco',  stamp)} 480w`,
    `${cloudinaryPosterUrl(publicId,  960, 'eco',  stamp)} 960w`,
    `${cloudinaryPosterUrl(publicId, 1920, 'good', stamp)} 1920w`,
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
 * Called immediately (synchronously) after a successful upload — does NOT
 * wait for requestIdleCallback so the UI updates without delay.
 *
 * Poster cache strategy:
 *   Increments the version stamp and appends ?v=<stamp> to all poster URLs.
 *   Because the src string changes, the browser treats it as a new resource
 *   and bypasses both the HTTP cache and the decoded image memory cache.
 *   This is the only reliable way to force <img> to show a new image.
 *
 * Video cache strategy:
 *   Dispatches 'heroVideoChanged' immediately so HeroVideoSection tears down
 *   the old HLS/MP4 instance and starts fresh with the new publicId. The
 *   background fetch with cache:'reload' refreshes the HTTP cache for the
 *   next page load but is not on the critical path.
 */
export function bustHeroCache(publicId: string = HERO_PUBLIC_ID): void {
  if (typeof window === 'undefined') return

  // 1. Increment stamp — changes all poster src URLs → forces browser re-fetch
  _posterStamp = Date.now()
  writeStamp(_posterStamp)

  // 2. Mutate singleton immediately so HeroVideoSection reads new values
  heroVideo.public_id   = publicId
  heroVideo.hlsUrl      = cloudinaryHlsUrl(publicId)
  heroVideo.mp4Url      = cloudinaryMp4Url(publicId)
  heroVideo.posterUrl   = cloudinaryPosterUrl(publicId, 1920, 'good', _posterStamp)
  heroVideo.posterStamp = _posterStamp

  // 3. Update preload hints for next navigation
  injectPreloadHints(publicId, _posterStamp)

  // 4. Tell HeroVideoSection to reload NOW — no idle callback delay
  window.dispatchEvent(
    new CustomEvent('heroVideoChanged', { detail: { publicId, stamp: _posterStamp } })
  )

  // 5. Background: refresh HTTP cache so CDN serves fresh bytes on next hard load.
  //    Runs in rIC so it has zero impact on the UI update above.
  const warmCache = () => {
    const opts: RequestInit = { method: 'GET', cache: 'reload', credentials: 'omit' }
    Promise.allSettled([
      fetch(cloudinaryMp4Url(publicId), { ...opts, headers: { Range: 'bytes=0-0' } }),
      fetch(cloudinaryPosterUrl(publicId,  480, 'eco',  _posterStamp), opts),
      fetch(cloudinaryPosterUrl(publicId,  960, 'eco',  _posterStamp), opts),
      fetch(cloudinaryPosterUrl(publicId, 1920, 'good', _posterStamp), opts),
    ]).catch(() => {})
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(warmCache, { timeout: 10_000 })
  } else {
    setTimeout(warmCache, 3000)
  }
}

// ─── Module init ──────────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  injectConnectionHints()
  injectPreloadHints()
}
