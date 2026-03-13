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

// How long to wait for video to start playing before giving up and showing
// the poster permanently. Reduced from 8 s — MP4 should start in < 2 s on
// any decent connection since we preload it. 4 s is generous for slow links.
const PLAY_TIMEOUT_MS = 4_000

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoReady,  setVideoReady]  = useState(false)
  const [loopSeeking, setLoopSeeking] = useState(false)
  const hasStartedRef = useRef(false)

  // publicId + posterStamp — both update on heroVideoChanged so the poster
  // <img> src changes (stamp appended as ?v=N) and bypasses the browser's
  // decoded image memory cache. Without a changed src the old poster stays
  // on screen even after the new image has been fetched.
  const [publicId,    setPublicId]    = useState(() => getHeroVideo().public_id)
  const [posterStamp, setPosterStamp] = useState(() => getHeroVideo().posterStamp)

  useEffect(() => {
    const handler = (e: Event) => {
      const { publicId: newId, stamp } =
        (e as CustomEvent<{ publicId: string; stamp: number }>).detail ?? {}
      if (newId && newId !== publicId) {
        hasStartedRef.current = false
        setVideoReady(false)
        setLoopSeeking(false)
        setPublicId(newId)
      }
      // Always update stamp — even if publicId didn't change, stamp change
      // means a new poster was uploaded and must be shown.
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

  // ─── Video playback effect ──────────────────────────────────────────────────
  // MP4-only. No HLS upgrade mid-play.
  //
  // hls.js attaches to the <video> element and resets its media pipeline when
  // it takes over from a playing MP4 — this is what caused the 1-2 s black
  // flash. For a muted looping background video adaptive bitrate adds no value
  // that justifies that disruption. Single q_auto:good MP4 is the right tool.
  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    let destroyed = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const mp4Url = cloudinaryMp4Url(publicId)

    // Reveal poster → video: wait for 2 actual painted frames so there is
    // no single-frame flash of black between poster fade and video.
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

    // Safety valve — if video never fires 'playing' reveal the page anyway.
    timeoutId = setTimeout(() => { if (!destroyed) markReady() }, PLAY_TIMEOUT_MS)

    video.src = mp4Url
    video.load()
    video.play().catch(() => {
      if (destroyed) return
      // Autoplay policy blocked — retry on first user gesture.
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
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('seeked',  onSeeked)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipVideo, markReady, publicId])

  const showPoster = !videoReady || loopSeeking

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

      {/* key includes posterStamp — forces React to remount the <img> element
          when the stamp changes, guaranteeing the browser issues a new request
          even if the decoded image memory cache has the old URL cached. */}
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
          opacity:        showPoster ? 1 : 0,
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
