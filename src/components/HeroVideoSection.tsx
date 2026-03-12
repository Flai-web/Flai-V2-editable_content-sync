import React, { useRef, useEffect, useState, useCallback } from 'react'
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

// ─── Connection helpers ───────────────────────────────────────────────────────
// Evaluated lazily inside the component so connection state at mount time
// is used — not stale module-load time (matters when navigating back to home).
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

const { public_id: PUBLIC_ID } = getHeroVideo()

const POSTER_480  = cloudinaryPosterUrl(PUBLIC_ID, 480)
const POSTER_960  = cloudinaryPosterUrl(PUBLIC_ID, 960)
const POSTER_1920 = cloudinaryPosterUrl(PUBLIC_ID, 1920)
const POSTER_SRCSET = `${POSTER_480} 480w, ${POSTER_960} 960w, ${POSTER_1920} 1920w`

// How long to wait for the first frame before giving up and showing poster only.
// 12 s covers most slow-but-not-dead connections.
const PLAY_TIMEOUT_MS = 12_000

// ─── Component ────────────────────────────────────────────────────────────────
const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  // true  → first frame confirmed painted; hide poster overlay
  // false → show poster overlay (initial state / slow connection / loop-restart gap)
  const [videoReady, setVideoReady] = useState(false)
  const [loopSeeking, setLoopSeeking] = useState(false)

  // Ref that tracks whether we have ever confirmed a first frame.
  // Using a ref (not state) so the seeking handler can read it synchronously
  // without a stale-closure problem from the useEffect dependency array.
  const hasStartedRef = useRef(false)

  // Separate flag so we only attempt video load when appropriate
  const [skipVideo]  = useState(() => {
    const { isSlow, saveData } = getConnectionInfo()
    return isSlow || saveData
  })

  // ── Stable callback so useEffect dependency is clean ──────────────────────
  const markReady = useCallback(() => {
    hasStartedRef.current = true
    setVideoReady(true)
  }, [])

  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    let destroyed   = false
    let hlsInstance: Hls | null = null
    let timeoutId:   ReturnType<typeof setTimeout> | null = null

    // ── Safety net: if playing event never fires, reveal video anyway ────────
    // This prevents the poster being stuck forever when:
    //  • autoplay is silently blocked mid-session
    //  • the tab was backgrounded before first-frame
    //  • a non-fatal HLS stall never recovers
    timeoutId = setTimeout(() => {
      if (!destroyed) markReady()
    }, PLAY_TIMEOUT_MS)

    // ── First-frame detection ─────────────────────────────────────────────────
    // We wait for the actual first painted frame before hiding the poster.
    // requestVideoFrameCallback fires exactly when a frame has been composited
    // to the screen — this guarantees zero black flash between poster and video.
    const onPlaying = () => {
      if (destroyed) return
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }

      if (typeof (video as any).requestVideoFrameCallback === 'function') {
        // Double-rAF ensures the frame is fully composited before we hide the poster.
        ;(video as any).requestVideoFrameCallback(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { if (!destroyed) markReady() })
          })
        })
      } else {
        // Fallback: wait for two timeupdate events to be safe (first may fire
        // before the frame is actually painted on some browsers).
        let ticks = 0
        const onTimeUpdate = () => {
          if (destroyed) return
          ticks++
          if (ticks >= 2) {
            video.removeEventListener('timeupdate', onTimeUpdate)
            markReady()
          }
        }
        video.addEventListener('timeupdate', onTimeUpdate)
      }
    }

    // ── Handle autoplay being blocked (returns a rejected Promise) ───────────
    const tryPlay = (src?: string): void => {
      if (src) { video.src = src }
      video.load()
      const p = video.play()
      if (p) {
        p.catch(() => {
          if (destroyed) return
          // Autoplay blocked — attach gesture listeners and retry once
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

    // ── Loop-restart flash prevention ────────────────────────────────────────
    // When a looping video seeks back to 0, there's a brief black frame before
    // the first frame renders. We show the poster during this gap.
    const onSeeking = () => {
      if (destroyed) return
      // Only cover during loop seeks — hasStartedRef is true only after the
      // first frame has been confirmed painted, so this never fires on initial load.
      if (hasStartedRef.current && video.currentTime < 0.5) {
        setLoopSeeking(true)
      }
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

    // ── HLS path (Chrome, Firefox, Edge, Android) ─────────────────────────────
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        // startLevel: -1 lets hls.js auto-select based on bandwidth estimate.
        // This is the single biggest win for first-frame speed on good connections.
        startLevel:           -1,

        // Don't let hls.js serve a resolution larger than the player element.
        capLevelToPlayerSize: true,

        // 6 s initial buffer is enough to start playing without waiting for a
        // full 10 s segment. Back-fill up to 20 s once playing.
        maxBufferLength:      6,
        maxMaxBufferLength:   20,

        // Use a SharedArrayBuffer worker when available (faster ABR maths).
        enableWorker:         true,
        lowLatencyMode:       false,

        // Pre-fetch the next fragment so playback doesn't stutter at segment boundaries.
        startFragPrefetch:    true,
        autoStartLoad:        true,

        // Conservative ABR — prefer not dropping quality mid-play.
        abrBandWidthFactor:   0.95,
        abrBandWidthUpFactor: 0.7,

        // Retry stalled fragment loads up to 6 times before declaring fatal.
        fragLoadingMaxRetry:        6,
        fragLoadingRetryDelay:      500,
        fragLoadingMaxRetryTimeout: 4_000,

        // Retry manifest loads up to 3 times.
        manifestLoadingMaxRetry:        3,
        manifestLoadingRetryDelay:      500,
      })

      hlsInstance.attachMedia(video)
      hlsInstance.loadSource(hlsUrl)

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!destroyed) tryPlay()
      })

      // ── Non-fatal stall recovery ────────────────────────────────────────────
      // hls.js can enter a BUFFER_STALLED state without emitting a fatal error.
      // Detect it and nudge the currentTime to unblock the pipeline.
      hlsInstance.on(Hls.Events.ERROR, (_e, data) => {
        if (destroyed) return
        if (data.fatal) {
          // Fatal: destroy HLS and fall back to plain MP4
          hlsInstance?.destroy()
          hlsInstance = null
          tryPlay(mp4Url)
        } else if (
          data.type    === Hls.ErrorTypes.MEDIA_ERROR &&
          data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR
        ) {
          // Non-fatal stall: attempt inline recovery first
          hlsInstance?.recoverMediaError()
        }
      })
    } else {
      // ── Native HLS (Safari desktop + iOS) or MP4 fallback ────────────────────
      // Safari supports HLS natively via <video src=".m3u8">.
      // For every other non-hls.js browser, fall back to progressive MP4.
      const useNativeHls =
        video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
        video.canPlayType('application/x-mpegURL') !== ''

      tryPlay(useNativeHls ? hlsUrl : mp4Url)
    }

    return () => {
      destroyed = true
      if (timeoutId) clearTimeout(timeoutId)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('seeked',  onSeeked)
      hlsInstance?.destroy()
      hlsInstance = null
      // Clearing src stops network activity without triggering a visible flash
      // because the poster img is still visible in the DOM at this point.
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // IMPORTANT: videoReady and loopSeeking are intentionally excluded from deps.
  // This effect sets them but never needs to re-run because of them.
  // Including them causes a full teardown (video.src removed) on first-frame,
  // which is exactly the blank-flash bug we are fixing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, markReady])

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {/* Video layer — always mounted (unless data-saver / 2G) so the browser
          can start buffering immediately; hidden behind the poster until ready. */}
      {!skipVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          // Both attribute forms needed: React prop + HTML attribute for older
          // WebKit builds that only honour the HTML attribute.
          {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
          // metadata gives us duration + dimensions without buffering content;
          // the JS effect then takes over and loads the real source.
          // Do NOT use "auto" here — hls.js manages buffering itself and
          // "auto" on the element causes a redundant speculative MP4 fetch.
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
            // Keep video compositing-invisible until the first frame is confirmed.
            // opacity/z-index alone can't prevent the video's black background from
            // flickering through for one paint cycle. visibility:hidden is atomic —
            // the element is excluded from the compositor entirely until flipped.
            visibility:     (videoReady && !loopSeeking) ? 'visible' : 'hidden',
          }}
        />
      )}

      {/* Poster overlay — visible until the exact moment the first video frame
          is composited on screen, then instantly hidden (no transition/fade).
          Any opacity transition creates a gap where neither poster nor video
          frame is visible, causing the premature early-fade effect. */}
      <img
        src={POSTER_1920}
        srcSet={POSTER_SRCSET}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        {...({ fetchpriority: 'high' } as any)}
        decoding="sync"
        style={{
          position:         'absolute',
          inset:            0,
          width:            '100%',
          height:           '100%',
          objectFit:        'cover',
          objectPosition:   'center',
          zIndex:           1,
          pointerEvents:    'none',
          // No transition — instant atomic swap with the first video frame.
          opacity:          (videoReady && !loopSeeking) ? 0 : 1,
        }}
      />

      {/* Gradient overlay */}
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