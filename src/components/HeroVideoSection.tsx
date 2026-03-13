import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import {
  getHeroVideo,
  cloudinaryMp4Url,
  cloudinaryPosterUrl,
} from '../utils/heroPreload'

export interface HeroVideoSectionProps {
  className?: string
  children?: React.ReactNode
  videoUrl?: string
}

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

const PLAY_TIMEOUT_MS = 4_000

// How many seconds before the end to start the crossfade to the next instance.
const CROSSFADE_START_S  = 1.5
// How long the crossfade lasts in ms. Must be <= CROSSFADE_START_S * 1000.
const CROSSFADE_DURATION_MS = 1_200

const VIDEO_STYLE: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  width:          '100%',
  height:         '100%',
  objectFit:      'cover',
  objectPosition: 'center',
  display:        'block',
  transition:     `opacity ${CROSSFADE_DURATION_MS}ms ease`,
}

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  // Two video refs — A and B alternate as active/standby.
  const refA = useRef<HTMLVideoElement>(null)
  const refB = useRef<HTMLVideoElement>(null)

  // Which video is currently the visible one: 'a' or 'b'
  const [active, setActive] = useState<'a' | 'b'>('a')

  const [videoReady,  setVideoReady]  = useState(false)
  const hasStartedRef = useRef(false)

  const [publicId,    setPublicId]    = useState(() => getHeroVideo().public_id)
  const [posterStamp, setPosterStamp] = useState(() => getHeroVideo().posterStamp)

  useEffect(() => {
    const handler = (e: Event) => {
      const { publicId: newId, stamp } =
        (e as CustomEvent<{ publicId: string; stamp: number }>).detail ?? {}
      if (newId && newId !== publicId) {
        hasStartedRef.current = false
        setVideoReady(false)
        setActive('a')
        setPublicId(newId)
      }
      if (typeof stamp === 'number') setPosterStamp(stamp)
    }
    window.addEventListener('heroVideoChanged', handler)
    return () => window.removeEventListener('heroVideoChanged', handler)
  }, [publicId])

  const POSTER_480    = useMemo(() => cloudinaryPosterUrl(publicId,  480, 'eco',  posterStamp), [publicId, posterStamp])
  const POSTER_960    = useMemo(() => cloudinaryPosterUrl(publicId,  960, 'eco',  posterStamp), [publicId, posterStamp])
  const POSTER_1920   = useMemo(() => cloudinaryPosterUrl(publicId, 1920, 'good', posterStamp), [publicId, posterStamp])
  const POSTER_SRCSET = useMemo(
    () => `${POSTER_480} 480w, ${POSTER_960} 960w, ${POSTER_1920} 1920w`,
    [POSTER_480, POSTER_960, POSTER_1920],
  )

  const [skipVideo] = useState(() => {
    const { isSlow, saveData } = getConnectionInfo()
    return isSlow || saveData
  })

  const markReady = useCallback(() => {
    hasStartedRef.current = true
    setVideoReady(true)
  }, [])

  useEffect(() => {
    if (skipVideo) return

    const videoA = refA.current
    const videoB = refB.current
    if (!videoA || !videoB) return

    let destroyed    = false
    let timeoutId:   ReturnType<typeof setTimeout> | null = null
    let crossfading  = false
    // Which is currently playing ('a' starts as active)
    let currentRef   = videoA
    let standbyRef   = videoB

    const mp4Url = cloudinaryMp4Url(publicId)

    // ── Utility ──────────────────────────────────────────────────────────────
    const prepareStandby = (vid: HTMLVideoElement) => {
      vid.src = mp4Url
      vid.load()
      // Preload enough that it can start instantly when we call play()
      // We don't call play() yet — just let the browser buffer the start.
    }

    // ── First-frame reveal ───────────────────────────────────────────────────
    const onFirstPlaying = () => {
      if (destroyed) return
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }

      if (typeof (videoA as any).requestVideoFrameCallback === 'function') {
        ;(videoA as any).requestVideoFrameCallback(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { if (!destroyed) markReady() })
          })
        })
      } else {
        let ticks = 0
        const onTU = () => {
          if (destroyed) return
          if (++ticks >= 2) { videoA.removeEventListener('timeupdate', onTU); markReady() }
        }
        videoA.addEventListener('timeupdate', onTU)
      }
    }

    videoA.addEventListener('playing', onFirstPlaying, { once: true })

    // ── Crossfade loop ───────────────────────────────────────────────────────
    // timeupdate on the ACTIVE video. When it gets close to the end:
    //   1. Start the standby video playing (it's already buffered at frame 0)
    //   2. Fade active out, standby in via CSS transition (opacity)
    //   3. After the transition, pause+reset the old active, prepare it as
    //      the new standby for the next loop.
    const onTimeUpdate = () => {
      if (destroyed || crossfading) return

      const { duration, currentTime } = currentRef
      if (!duration || !isFinite(duration)) return
      if (currentTime < duration - CROSSFADE_START_S) return

      crossfading = true

      // The standby video was preloaded — start it now.
      standbyRef.play().catch(() => {})

      // Swap which React state is 'active' — CSS transition handles the fade.
      const nextActive = currentRef === videoA ? 'b' : 'a'
      setActive(nextActive)

      // After the crossfade completes, reset the old video and make it standby.
      setTimeout(() => {
        if (destroyed) return
        const old = currentRef
        old.pause()
        old.currentTime = 0
        // Don't call old.load() — we want it buffered and ready, just paused.

        // Swap pointers for the next loop iteration.
        standbyRef = currentRef
        currentRef = nextActive === 'a' ? videoA : videoB

        // Re-attach timeupdate to the new active video.
        currentRef.addEventListener('timeupdate', onTimeUpdate)
        old.removeEventListener('timeupdate', onTimeUpdate)

        crossfading = false
      }, CROSSFADE_DURATION_MS + 100)
    }

    // Safety valve
    timeoutId = setTimeout(() => { if (!destroyed) markReady() }, PLAY_TIMEOUT_MS)

    // Boot sequence:
    // 1. Prepare standby (B) — buffer from start without playing
    prepareStandby(videoB)
    // 2. Start active (A)
    videoA.src = mp4Url
    videoA.load()
    videoA.addEventListener('timeupdate', onTimeUpdate)
    videoA.play().catch(() => {
      if (destroyed) return
      const retry = () => {
        videoA.play().catch(() => {})
        document.removeEventListener('touchstart', retry)
        document.removeEventListener('click',      retry)
      }
      document.addEventListener('touchstart', retry, { once: true })
      document.addEventListener('click',      retry, { once: true })
    })

    return () => {
      destroyed = true
      if (timeoutId) clearTimeout(timeoutId)
      videoA.removeEventListener('playing',    onFirstPlaying)
      videoA.removeEventListener('timeupdate', onTimeUpdate)
      videoB.removeEventListener('timeupdate', onTimeUpdate)
      ;[videoA, videoB].forEach(v => {
        v.pause()
        v.removeAttribute('src')
        v.load()
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, markReady, publicId])

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {!skipVideo && (
        <>
          <video
            key={`a-${publicId}`}
            ref={refA}
            autoPlay
            muted
            playsInline
            {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
            preload="auto"
            style={{
              ...VIDEO_STYLE,
              zIndex:  0,
              opacity: !videoReady ? 0 : active === 'a' ? 1 : 0,
            }}
          />
          <video
            key={`b-${publicId}`}
            ref={refB}
            muted
            playsInline
            {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
            preload="auto"
            style={{
              ...VIDEO_STYLE,
              zIndex:  0,
              opacity: !videoReady ? 0 : active === 'b' ? 1 : 0,
            }}
          />
        </>
      )}

      {/* Poster sits above both videos, fades out once video is ready */}
      <img
        key={`poster-${publicId}-${posterStamp}`}
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
          opacity:        videoReady ? 0 : 1,
          transition:     'opacity 0.3s ease',
        }}
      />

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
