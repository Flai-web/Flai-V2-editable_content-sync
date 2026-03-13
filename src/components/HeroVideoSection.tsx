import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import Hls from 'hls.js'
import {
  getHeroVideo,
  cloudinaryMp4Url,
  cloudinaryPosterUrl,
  cloudinaryHlsUrl,
} from '../utils/heroPreload'

export interface HeroVideoSectionProps {
  className?: string
  children?: React.ReactNode
}

// ─── Connection quality check ─────────────────────────────────────────────────
// Evaluated lazily at mount, not at module load, so navigating back to the home
// page re-reads the current connection (could have changed since first load).
function getConnectionInfo() {
  if (typeof navigator === 'undefined') return { isSlow: false, saveData: false }
  const conn =
    (navigator as any).connection ??
    (navigator as any).mozConnection ??
    (navigator as any).webkitConnection
  return {
    isSlow:   conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g',
    saveData: conn?.saveData === true,
  }
}

// How long to wait for first frame before revealing the video regardless.
// 8 s (was 12 s): on connections slow enough that 8 s isn't enough, the video
// quality will be unacceptably degraded anyway — better to show it earlier.
const PLAY_TIMEOUT_MS = 8_000

// ─── Component ────────────────────────────────────────────────────────────────
const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({
  className = '',
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  // videoReady: true once first frame is composited to screen
  // loopSeeking: true during the loop-restart gap to prevent black flash
  const [videoReady,  setVideoReady]  = useState(false)
  const [loopSeeking, setLoopSeeking] = useState(false)

  // Read by seeking handler synchronously — ref avoids stale closure issue
  const hasStartedRef = useRef(false)

  // ── Derive stable URLs from the module singleton ──────────────────────────
  const { public_id: PUBLIC_ID } = useMemo(() => getHeroVideo(), [])

  // q_auto:eco for sub-1080 breakpoints — ~25% smaller, zero perceptible diff
  const POSTER_480    = useMemo(() => cloudinaryPosterUrl(PUBLIC_ID,  480, 'eco'),  [PUBLIC_ID])
  const POSTER_960    = useMemo(() => cloudinaryPosterUrl(PUBLIC_ID,  960, 'eco'),  [PUBLIC_ID])
  const POSTER_1920   = useMemo(() => cloudinaryPosterUrl(PUBLIC_ID, 1920, 'good'), [PUBLIC_ID])
  const POSTER_SRCSET = useMemo(
    () => `${POSTER_480} 480w, ${POSTER_960} 960w, ${POSTER_1920} 1920w`,
    [POSTER_480, POSTER_960, POSTER_1920],
  )

  // ── Skip video on metered / 2G connections ────────────────────────────────
  const [skipVideo] = useState(() => {
    const { isSlow, saveData } = getConnectionInfo()
    return isSlow || saveData
  })

  // ── markReady is stable — prevents useEffect teardown on first frame ──────
  const markReady = useCallback(() => {
    hasStartedRef.current = true
    setVideoReady(true)
  }, [])

  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    let destroyed    = false
    let hlsInstance: Hls | null = null
    let timeoutId:   ReturnType<typeof setTimeout> | null = null

    // ── Safety-net: reveal video even if playing event never fires ────────────
    // Covers: autoplay silently blocked, tab hidden before first frame, non-fatal
    // HLS stalls. Reduced to 8 s — 12 s was excessive for modern connections.
    timeoutId = setTimeout(() => { if (!destroyed) markReady() }, PLAY_TIMEOUT_MS)

    // ── First-frame detection ─────────────────────────────────────────────────
    // requestVideoFrameCallback fires exactly when a frame is composited to the
    // screen. Two rAFs ensure the frame is fully painted before the swap.
    // This guarantees zero black flash between poster and video.
    const onPlaying = () => {
      if (destroyed) return
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }

      if (typeof (video as any).requestVideoFrameCallback === 'function') {
        ;(video as any).requestVideoFrameCallback(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { if (!destroyed) markReady() })
          })
        })
      } else {
        // Fallback: two timeupdate ticks — first can fire before frame is painted
        // on older browsers.
        let ticks = 0
        const onTU = () => {
          if (destroyed) return
          if (++ticks >= 2) {
            video.removeEventListener('timeupdate', onTU)
            markReady()
          }
        }
        video.addEventListener('timeupdate', onTU)
      }
    }

    // ── Autoplay-blocked recovery ─────────────────────────────────────────────
    const tryPlay = (src?: string): void => {
      if (src) video.src = src
      video.load()
      const p = video.play()
      if (p) {
        p.catch(() => {
          if (destroyed) return
          const retry = () => {
            video.play().catch(() => {})
            document.removeEventListener('touchstart', retry)
            document.removeEventListener('click',      retry)
          }
          document.addEventListener('touchstart', retry, { once: true })
          document.addEventListener('click',      retry, { once: true })
        })
      }
    }

    // ── Loop-restart flash prevention ─────────────────────────────────────────
    // Show poster during the black gap at loop point (seek to t=0).
    const onSeeking = () => {
      if (destroyed) return
      if (hasStartedRef.current && video.currentTime < 0.5) setLoopSeeking(true)
    }
    const onSeeked = () => {
      if (destroyed) return
      if (typeof (video as any).requestVideoFrameCallback === 'function') {
        ;(video as any).requestVideoFrameCallback(() => {
          requestAnimationFrame(() => { if (!destroyed) setLoopSeeking(false) })
        })
      } else {
        setLoopSeeking(false)
      }
    }

    video.addEventListener('playing', onPlaying)
    video.addEventListener('seeking', onSeeking)
    video.addEventListener('seeked',  onSeeked)

    const mp4Url = cloudinaryMp4Url(PUBLIC_ID)
    const hlsUrl = cloudinaryHlsUrl(PUBLIC_ID)

    // ── HLS path: Chrome, Firefox, Edge, Android ──────────────────────────────
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        // ── Startup speed ────────────────────────────────────────────────────
        startLevel:           -1,    // auto-select by bandwidth estimate
        capLevelToPlayerSize: true,  // never fetch resolution > element size

        // maxBufferLength:6 → plays after buffering 6 s, back-fills to 20 s.
        // Lower than 6 risks stalls; higher delays first-frame.
        maxBufferLength:    6,
        maxMaxBufferLength: 20,

        // startPosition:0 eliminates any seek-to-start overhead on init.
        startPosition: 0,

        // ── Worker + prefetch ─────────────────────────────────────────────────
        enableWorker:      true,   // ABR maths off main thread
        lowLatencyMode:    false,
        startFragPrefetch: true,   // pre-fetch next fragment at segment boundary
        autoStartLoad:     true,

        // ── ABR conservatism — avoid mid-play quality drops ───────────────────
        abrBandWidthFactor:   0.95,
        abrBandWidthUpFactor: 0.7,

        // ── Retry budget ──────────────────────────────────────────────────────
        fragLoadingMaxRetry:        6,
        fragLoadingRetryDelay:      500,
        fragLoadingMaxRetryTimeout: 4_000,
        manifestLoadingMaxRetry:    3,
        manifestLoadingRetryDelay:  500,
      })

      hlsInstance.attachMedia(video)
      hlsInstance.loadSource(hlsUrl)

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!destroyed) tryPlay()
      })

      hlsInstance.on(Hls.Events.ERROR, (_e, data) => {
        if (destroyed) return
        if (data.fatal) {
          hlsInstance?.destroy(); hlsInstance = null
          tryPlay(mp4Url)
        } else if (
          data.type    === Hls.ErrorTypes.MEDIA_ERROR &&
          data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR
        ) {
          hlsInstance?.recoverMediaError()
        }
      })
    } else {
      // ── Native HLS (Safari) or MP4 fallback ──────────────────────────────
      const useNativeHls =
        video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
        video.canPlayType('application/x-mpegURL')         !== ''
      tryPlay(useNativeHls ? hlsUrl : mp4Url)
    }

    return () => {
      destroyed = true
      if (timeoutId) clearTimeout(timeoutId)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('seeked',  onSeeked)
      hlsInstance?.destroy(); hlsInstance = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // videoReady / loopSeeking intentionally excluded: this effect sets them but
  // must never react to them — doing so triggers a full teardown on first-frame
  // (src removed) which is the blank-flash bug we are preventing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, markReady, PUBLIC_ID])

  const showPoster = !videoReady || loopSeeking

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {/* ── Video ──────────────────────────────────────────────────────────────
          Always mounted (unless 2G/saveData) so buffering starts before the
          poster has finished decoding. Hidden via visibility:hidden — atomic
          compositor exclusion — until first frame is confirmed painted.
          opacity:0 is NOT sufficient: it still composites the black background
          through for one cycle. */}
      {!skipVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
          // preload="metadata": dimensions + duration without buffering payload.
          // hls.js owns buffering. "auto" causes a redundant speculative MP4 fetch.
          preload="metadata"
          style={{
            position:       'absolute',
            inset:          0,
            width:          '100%',
            height:         '100%',
            objectFit:      'cover',
            objectPosition: 'center',
            zIndex:         0,
            display:        'block',
            visibility:     showPoster ? 'hidden' : 'visible',
          }}
        />
      )}

      {/* ── Poster ─────────────────────────────────────────────────────────────
          fetchpriority="high" + decoding="sync" + the module-level preload tag
          together guarantee the poster is decoded and painted as early as
          physically possible — typically before React's first commit.

          NO opacity transition. Any fade creates a gap where neither poster
          nor video is visible. Atomic instant swap only. */}
      <img
        src={POSTER_1920}
        srcSet={POSTER_SRCSET}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        {...({ fetchpriority: 'high' } as any)}
        decoding="sync"
        style={{
          position:       'absolute',
          inset:          0,
          width:          '100%',
          height:         '100%',
          objectFit:      'cover',
          objectPosition: 'center',
          zIndex:         1,
          pointerEvents:  'none',
          opacity:        showPoster ? 1 : 0,
        }}
      />

      {/* ── Gradient ───────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          zIndex:        2,
          background:    'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative text-center" style={{ zIndex: 3 }}>
        <div className="max-w-3xl mx-auto px-4">{children}</div>
      </div>
    </section>
  )
}

export default HeroVideoSection
