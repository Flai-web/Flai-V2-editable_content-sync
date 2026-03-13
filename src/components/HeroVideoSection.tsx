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
  videoUrl?: string  // unused — kept for API compat with HomePage
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

// How many seconds before the end to seek back to 0.
// Large enough that the browser has buffered the start before we arrive there,
// small enough that it's imperceptible. 0.3 s is a safe sweet-spot.
const LOOP_PREROLL_S = 0.3

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const videoRef      = useRef<HTMLVideoElement>(null)
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
    const video = videoRef.current
    if (!video) return

    let destroyed = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let loopArmed  = false   // true once duration is known and loop logic is active

    // ── First-frame detection ────────────────────────────────────────────────
    // Wait for 2 painted frames before swapping poster → video so there's no
    // single-frame black flash on reveal.
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
        let ticks = 0
        const onTU = () => {
          if (destroyed) return
          if (++ticks >= 2) { video.removeEventListener('timeupdate', onTU); markReady() }
        }
        video.addEventListener('timeupdate', onTU)
      }
    }

    // ── Seamless loop via timeupdate ─────────────────────────────────────────
    // The native `loop` attribute seeks to 0 after the last frame — the decoder
    // has no frame ready at that instant → black flash.
    //
    // Instead: we watch timeupdate and seek to 0 when we're LOOP_PREROLL_S
    // seconds from the end. The video is already playing; we just move the
    // playhead back before it runs out. The browser never stalls, the decoder
    // always has a frame ready, and the viewer never notices the loop point.
    const onTimeUpdate = () => {
      if (destroyed || !loopArmed) return
      const { duration, currentTime } = video
      if (!duration || !isFinite(duration)) return
      if (currentTime >= duration - LOOP_PREROLL_S) {
        video.currentTime = 0
      }
    }

    // onDurationChange fires once the browser knows the video length.
    // Only then can we safely arm the loop logic.
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) loopArmed = true
    }

    video.addEventListener('playing',        onPlaying)
    video.addEventListener('timeupdate',     onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)

    // Safety valve
    timeoutId = setTimeout(() => { if (!destroyed) markReady() }, PLAY_TIMEOUT_MS)

    video.src = cloudinaryMp4Url(publicId)
    video.load()
    video.play().catch(() => {
      if (destroyed) return
      const retry = () => {
        video.play().catch(() => {})
        document.removeEventListener('touchstart', retry)
        document.removeEventListener('click',      retry)
      }
      document.addEventListener('touchstart', retry, { once: true })
      document.addEventListener('click',      retry, { once: true })
    })

    return () => {
      destroyed = true
      if (timeoutId) clearTimeout(timeoutId)
      video.removeEventListener('playing',        onPlaying)
      video.removeEventListener('timeupdate',     onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, markReady, publicId])

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {!skipVideo && (
        <video
          key={publicId}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
          preload="auto"
          style={{
            position:       'absolute',
            inset:          0,
            width:          '100%',
            height:         '100%',
            objectFit:      'cover',
            objectPosition: 'center',
            zIndex:         0,
            display:        'block',
            visibility:     videoReady ? 'visible' : 'hidden',
          }}
        />
      )}

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
