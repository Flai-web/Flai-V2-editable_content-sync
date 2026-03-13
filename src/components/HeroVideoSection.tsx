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

// How many seconds before the end to start B playing so it's ready for the cut.
const SWITCH_BEFORE_END_S = 1.5

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
  const refA = useRef<HTMLVideoElement>(null)
  const refB = useRef<HTMLVideoElement>(null)

  // Which video element is currently the visible one
  const [active, setActive] = useState<'a' | 'b'>('a')

  // videoReady: true once the first real video frame has been painted.
  // Until then the poster stays on top so there's never a flash of black
  // or the background colour before the video arrives.
  const [videoReady, setVideoReady] = useState(false)

  // posterReady: true once the CURRENT stamp poster has finished loading.
  // Until then we keep the previous (cached) poster visible underneath.
  // This means: cached poster shows instantly, fresh poster replaces it
  // silently once it has loaded — user never sees a blank gap.
  const [posterReady, setPosterReady] = useState(false)

  const [publicId,    setPublicId]    = useState(() => getHeroVideo().public_id)
  const [posterStamp, setPosterStamp] = useState(() => getHeroVideo().posterStamp)

  // The "previous" stamp is stamp=0 (no ?v= param) — the version the browser
  // may have cached from a previous visit. We render it underneath as fallback.
  const cachedPosterUrl = useMemo(
    () => cloudinaryPosterUrl(publicId, 1920, 'good', 0),
    [publicId]
  )

  // The current stamp poster — may be the same URL if stamp===0
  const freshPosterUrl  = useMemo(
    () => cloudinaryPosterUrl(publicId, 1920, 'good', posterStamp),
    [publicId, posterStamp]
  )
  const freshPoster480  = useMemo(() => cloudinaryPosterUrl(publicId,  480, 'eco',  posterStamp), [publicId, posterStamp])
  const freshPoster960  = useMemo(() => cloudinaryPosterUrl(publicId,  960, 'eco',  posterStamp), [publicId, posterStamp])
  const freshPosterSrcSet = useMemo(
    () => `${freshPoster480} 480w, ${freshPoster960} 960w, ${freshPosterUrl} 1920w`,
    [freshPoster480, freshPoster960, freshPosterUrl]
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { publicId: newId, stamp } =
        (e as CustomEvent<{ publicId: string; stamp: number }>).detail ?? {}
      if (newId && newId !== publicId) {
        setActive('a')
        setVideoReady(false)
        setPosterReady(false)
        setPublicId(newId)
      }
      if (typeof stamp === 'number') {
        setPosterReady(false) // new stamp = new poster incoming, reset ready state
        setPosterStamp(stamp)
      }
    }
    window.addEventListener('heroVideoChanged', handler)
    return () => window.removeEventListener('heroVideoChanged', handler)
  }, [publicId])

  const [skipVideo] = useState(() => {
    const { isSlow, saveData } = getConnectionInfo()
    return isSlow || saveData
  })

  // ── Video playback ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (skipVideo) return
    const videoA = refA.current
    const videoB = refB.current
    if (!videoA || !videoB) return

    let destroyed  = false
    let switching  = false
    let currentVid = videoA
    let standbyVid = videoB

    const mp4Url = cloudinaryMp4Url(publicId)

    // Hide poster only after an actual video frame has been painted.
    // requestVideoFrameCallback guarantees the frame is on screen before we act.
    const onFirstFrame = () => {
      if (destroyed) return
      if (typeof (videoA as any).requestVideoFrameCallback === 'function') {
        ;(videoA as any).requestVideoFrameCallback(() => {
          if (!destroyed) setVideoReady(true)
        })
      } else {
        // Fallback: two timeupdate ticks = at least one frame rendered
        let ticks = 0
        const onTU = () => {
          if (destroyed) return
          if (++ticks >= 2) {
            videoA.removeEventListener('timeupdate', onTU)
            setVideoReady(true)
          }
        }
        videoA.addEventListener('timeupdate', onTU)
      }
    }
    videoA.addEventListener('playing', onFirstFrame, { once: true })

    // Seamless loop: B starts 1.5 s before A ends, instant cut when A finishes
    const onTimeUpdate = () => {
      if (destroyed || switching) return
      const { duration, currentTime } = currentVid
      if (!duration || !isFinite(duration)) return
      if (currentTime < duration - SWITCH_BEFORE_END_S) return

      switching = true
      standbyVid.play().catch(() => {})

      const next = currentVid === videoA ? 'b' : 'a'
      setActive(next)

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

    // Preload B silently — browser buffers from frame 0, does not play
    videoB.src = mp4Url
    videoB.load()

    // Start A
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
      videoA.removeEventListener('playing',    onFirstFrame)
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

  // Whether to show any poster layer at all:
  // - Always show until video is ready (first frame painted)
  // - On slow connections (skipVideo) always show
  const showPosterLayer = !videoReady || skipVideo

  return (
    <section
      className={`relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32 ${className}`}
      style={{ backgroundColor: '#111' }}
    >
      {!skipVideo && (
        <>
          {/* B underneath */}
          <video
            key={`b-${publicId}`}
            ref={refB}
            muted
            playsInline
            {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
            preload="auto"
            style={{ ...FILL_STYLE, zIndex: 0 }}
          />
          {/* A on top — hidden when B is active */}
          <video
            key={`a-${publicId}`}
            ref={refA}
            autoPlay
            muted
            playsInline
            {...({ 'webkit-playsinline': 'true', playsinline: 'true' } as any)}
            preload="auto"
            style={{ ...FILL_STYLE, zIndex: 1, opacity: active === 'a' ? 1 : 0 }}
          />
        </>
      )}

      {/* ── Poster layer ───────────────────────────────────────────────────────
          Two <img> elements stacked:
            - cachedImg (bottom): the stamp=0 URL the browser likely has cached
              from a previous visit. Shows instantly with zero network cost.
            - freshImg  (top):    the current-stamp URL. Hidden until loaded,
              then shown — silently replaces cached without any visible gap.
          Both are removed once the first real video frame is painted.
      */}
      {showPosterLayer && (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            zIndex:     2,
            pointerEvents: 'none',
          }}
        >
          {/* Cached poster — instant, may be from previous session */}
          <img
            key={`poster-cached-${publicId}`}
            src={cachedPosterUrl}
            alt=""
            aria-hidden="true"
            {...({ fetchpriority: 'high' } as any)}
            decoding="sync"
            style={{
              ...FILL_STYLE,
              zIndex:  0,
              // Hidden once fresh poster is ready — fresh takes over
              opacity: posterReady ? 0 : 1,
            }}
          />
          {/* Fresh poster — loads in background, takes over when ready */}
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
            style={{
              ...FILL_STYLE,
              zIndex:  1,
              // Only visible once loaded — avoids flash of empty/broken state
              opacity: posterReady ? 1 : 0,
            }}
          />
        </div>
      )}

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
