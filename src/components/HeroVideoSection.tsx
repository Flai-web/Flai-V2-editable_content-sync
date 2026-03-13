import React, {
  useRef,
  useEffect,
  useState,
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

// Start B playing this many seconds before A ends so it's already
// running when A cuts off. No fade — just an instant swap.
const SWITCH_BEFORE_END_S = 1.5

const VIDEO_STYLE: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  width:          '100%',
  height:         '100%',
  objectFit:      'cover',
  objectPosition: 'center',
  display:        'block',
}

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const refA = useRef<HTMLVideoElement>(null)
  const refB = useRef<HTMLVideoElement>(null)

  const [active,      setActive]      = useState<'a' | 'b'>('a')
  const [publicId,    setPublicId]    = useState(() => getHeroVideo().public_id)
  const [posterStamp, setPosterStamp] = useState(() => getHeroVideo().posterStamp)

  useEffect(() => {
    const handler = (e: Event) => {
      const { publicId: newId, stamp } =
        (e as CustomEvent<{ publicId: string; stamp: number }>).detail ?? {}
      if (newId && newId !== publicId) {
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

  useEffect(() => {
    if (skipVideo) return
    const videoA = refA.current
    const videoB = refB.current
    if (!videoA || !videoB) return

    let destroyed   = false
    let switching   = false
    let currentVid  = videoA
    let standbyVid  = videoB

    const mp4Url = cloudinaryMp4Url(publicId)

    const onTimeUpdate = () => {
      if (destroyed || switching) return
      const { duration, currentTime } = currentVid
      if (!duration || !isFinite(duration)) return
      if (currentTime < duration - SWITCH_BEFORE_END_S) return

      switching = true

      // Start standby — already buffered at frame 0, plays instantly
      standbyVid.play().catch(() => {})

      // Hard cut — no fade
      const next = currentVid === videoA ? 'b' : 'a'
      setActive(next)

      // Reset old video after a moment, make it standby for next loop
      setTimeout(() => {
        if (destroyed) return
        const old = currentVid
        old.pause()
        old.currentTime = 0

        standbyVid = currentVid
        currentVid = next === 'a' ? videoA : videoB

        currentVid.addEventListener('timeupdate', onTimeUpdate)
        old.removeEventListener('timeupdate', onTimeUpdate)

        switching = false
      }, 200)
    }

    // Preload standby at frame 0 without playing
    videoB.src = mp4Url
    videoB.load()

    // Start active
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
      videoA.removeEventListener('timeupdate', onTimeUpdate)
      videoB.removeEventListener('timeupdate', onTimeUpdate)
      ;[videoA, videoB].forEach(v => {
        v.pause()
        v.removeAttribute('src')
        v.load()
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, publicId])

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {!skipVideo && (
        <>
          {/* B underneath, A on top — only the active one is visible */}
          <video
            key={`b-${publicId}`}
            ref={refB}
            muted
            playsInline
            {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
            preload="auto"
            style={{ ...VIDEO_STYLE, zIndex: 0 }}
          />
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
              zIndex:  1,
              opacity: active === 'a' ? 1 : 0,
            }}
          />
        </>
      )}

      {/* Poster — sits above both videos, instantly hidden once skipped */}
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
          position:      'absolute',
          inset:         0,
          width:         '100%',
          height:        '100%',
          objectFit:     'cover',
          objectPosition:'center',
          zIndex:        2,
          pointerEvents: 'none',
          display:       skipVideo ? 'block' : 'none',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          zIndex:        3,
          background:    'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative text-center" style={{ zIndex: 4 }}>
        <div className="max-w-3xl mx-auto px-4">{children}</div>
      </div>
    </section>
  )
}

export default HeroVideoSection
