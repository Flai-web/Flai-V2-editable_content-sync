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

const PLAY_TIMEOUT_MS = 8_000

const HeroVideoSection: React.FC<HeroVideoSectionProps> = ({ className = '', children }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [videoReady,  setVideoReady]  = useState(false)
  const [loopSeeking, setLoopSeeking] = useState(false)
  const hasStartedRef = useRef(false)

  // publicId state — initialized from singleton, updated by bustHeroCache event.
  // Changing this re-runs the useEffect which tears down and reinitialises HLS.
  const [publicId, setPublicId] = useState(() => getHeroVideo().public_id)

  // Listen for bustHeroCache() completing after a new video upload.
  useEffect(() => {
    const handler = (e: Event) => {
      const newId = (e as CustomEvent<{ publicId: string }>).detail?.publicId
      if (newId && newId !== publicId) {
        hasStartedRef.current = false
        setVideoReady(false)
        setLoopSeeking(false)
        setPublicId(newId)
      }
    }
    window.addEventListener('heroVideoChanged', handler)
    return () => window.removeEventListener('heroVideoChanged', handler)
  }, [publicId])

  const POSTER_480    = useMemo(() => cloudinaryPosterUrl(publicId,  480, 'eco'),  [publicId])
  const POSTER_960    = useMemo(() => cloudinaryPosterUrl(publicId,  960, 'eco'),  [publicId])
  const POSTER_1920   = useMemo(() => cloudinaryPosterUrl(publicId, 1920, 'good'), [publicId])
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

  // Re-runs when publicId changes — tears down old HLS, starts new one
  useEffect(() => {
    if (skipVideo) return
    const video = videoRef.current
    if (!video) return

    let destroyed = false
    let hlsInstance: Hls | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    timeoutId = setTimeout(() => { if (!destroyed) markReady() }, PLAY_TIMEOUT_MS)

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

    const mp4Url = cloudinaryMp4Url(publicId)
    const hlsUrl = cloudinaryHlsUrl(publicId)

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        startLevel:           -1,
        capLevelToPlayerSize: true,
        maxBufferLength:      6,
        maxMaxBufferLength:   20,
        startPosition:        0,
        enableWorker:         true,
        lowLatencyMode:       false,
        startFragPrefetch:    true,
        autoStartLoad:        true,
        abrBandWidthFactor:   0.95,
        abrBandWidthUpFactor: 0.7,
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
  // publicId IN deps — must re-run when video changes after a bust
  // videoReady/loopSeeking OUT — they are written here, never read here
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

      <img
        key={`poster-${publicId}`}
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
