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

const FILL_STYLE: React.CSSProperties = {
  position:       'absolute',
  inset:          0,
  width:          '100%',
  height:         '100%',
  objectFit:      'cover',
  objectPosition: 'center',
  display:        'block',
}

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoReady,  setVideoReady]  = useState(false)
  const [posterReady, setPosterReady] = useState(false)

  const [publicId,    setPublicId]    = useState(() => getHeroVideo().public_id)
  const [posterStamp, setPosterStamp] = useState(() => getHeroVideo().posterStamp)

  useEffect(() => {
    const handler = (e: Event) => {
      const { publicId: newId, stamp } =
        (e as CustomEvent<{ publicId: string; stamp: number }>).detail ?? {}
      if (newId && newId !== publicId) {
        setVideoReady(false)
        setPosterReady(false)
        setPublicId(newId)
      }
      if (typeof stamp === 'number') {
        setPosterReady(false)
        setPosterStamp(stamp)
      }
    }
    window.addEventListener('heroVideoChanged', handler)
    return () => window.removeEventListener('heroVideoChanged', handler)
  }, [publicId])

  // Cached poster (stamp=0) — already in browser cache, shows instantly
  const cachedPosterUrl = useMemo(
    () => cloudinaryPosterUrl(publicId, 1920, 'good', 0),
    [publicId]
  )

  // Fresh poster — may include ?v=stamp if cache was busted after an upload
  const freshPosterUrl    = useMemo(() => cloudinaryPosterUrl(publicId, 1920, 'good', posterStamp), [publicId, posterStamp])
  const freshPoster480    = useMemo(() => cloudinaryPosterUrl(publicId,  480, 'eco',  posterStamp), [publicId, posterStamp])
  const freshPoster960    = useMemo(() => cloudinaryPosterUrl(publicId,  960, 'eco',  posterStamp), [publicId, posterStamp])
  const freshPosterSrcSet = useMemo(
    () => `${freshPoster480} 480w, ${freshPoster960} 960w, ${freshPosterUrl} 1920w`,
    [freshPoster480, freshPoster960, freshPosterUrl]
  )

  const [skipVideo] = useState(() => {
    const { isSlow, saveData } = getConnectionInfo()
    return isSlow || saveData
  })

  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    let destroyed = false

    // Remove poster only after a real frame is painted — no black flash
    const onFirstFrame = () => {
      if (destroyed) return
      if (typeof (video as any).requestVideoFrameCallback === 'function') {
        ;(video as any).requestVideoFrameCallback(() => {
          if (!destroyed) setVideoReady(true)
        })
      } else {
        let ticks = 0
        const onTU = () => {
          if (destroyed) return
          if (++ticks >= 2) { video.removeEventListener('timeupdate', onTU); setVideoReady(true) }
        }
        video.addEventListener('timeupdate', onTU)
      }
    }

    video.addEventListener('playing', onFirstFrame, { once: true })

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
      video.removeEventListener('playing', onFirstFrame)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, publicId])

  const showPosterLayer = !videoReady || skipVideo

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
          loop
          playsInline
          {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
          preload="auto"
          style={{ ...FILL_STYLE, zIndex: 0 }}
        />
      )}

      {/* Poster layer — two images stacked:
          cached (stamp=0) shows instantly from browser cache,
          fresh (current stamp) silently takes over once loaded.
          Both removed the moment the first real video frame is painted. */}
      {showPosterLayer && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
          <img
            key={`poster-cached-${publicId}`}
            src={cachedPosterUrl}
            alt=""
            aria-hidden="true"
            {...({ fetchpriority: 'high' } as any)}
            decoding="sync"
            style={{ ...FILL_STYLE, zIndex: 0, opacity: posterReady ? 0 : 1 }}
          />
          <img
            key={`poster-fresh-${publicId}-${posterStamp}`}
            src={freshPosterUrl}
            srcSet={freshPosterSrcSet}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            {...({ fetchpriority: 'high' } as any)}
            decoding="async"
            onLoad={() => setPosterReady(true)}
            style={{ ...FILL_STYLE, zIndex: 1, opacity: posterReady ? 1 : 0 }}
          />
        </div>
      )}

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
