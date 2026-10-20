import React, { useRef, useState } from 'react'
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Download,
  Heart,
  Loader2
} from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

export function FullScreenPlayer({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  shuffle,
  repeat,
  volume,
  currentTime,
  duration,
  isLiked,
  onToggleLike,
  onTogglePlayPause,
  onPlayPrev,
  onPlayNext,
  onToggleShuffle,
  onToggleRepeat,
  onSeek,
  onVolumeChange,
  onToggleQueue,
  onDownload,
  isDownloading
}) {
  const progressBarRef = useRef(null)
  const [hoverTime, setHoverTime] = useState(null)
  const [hoverPos, setHoverPos] = useState(0)
  const isDraggingRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isInteractive: false })

  if (!isOpen || !currentTrack) return null

  const calcPctFromEvent = (e) => {
    if (!duration || !progressBarRef.current) return 0
    const rect = progressBarRef.current.getBoundingClientRect()
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0
    const clickX = clientX - rect.left
    return Math.max(0, Math.min(1, clickX / rect.width))
  }

  const handlePointerDown = (e) => {
    if (!duration) return
    isDraggingRef.current = true
    const pct = calcPctFromEvent(e)
    onSeek(pct * duration)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e) => {
    if (!duration || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pct = calcPctFromEvent(e)
    setHoverTime(pct * duration)
    setHoverPos(Math.max(0, Math.min(rect.width, (e.clientX ?? 0) - rect.left)))

    if (isDraggingRef.current) {
      onSeek(pct * duration)
    }
  }

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      } catch {}
    }
  }

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      setHoverTime(null)
    }
  }

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    // Don't treat clicking buttons, volume or scrubber as swipe dismiss
    const isInteractive = !!e.target.closest('button, input, .progress-bar-wrap, .vol-slider')
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isInteractive
    }
  }

  const handleTouchEnd = (e) => {
    if (touchStartRef.current.isInteractive) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const elapsed = Date.now() - touchStartRef.current.time

    // Swipe Down: deltaY > 45px and vertically dominant
    if (deltaY > 45 && Math.abs(deltaY) > Math.abs(deltaX) && elapsed < 800) {
      onClose()
    }
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const artwork =
    currentTrack.coverImage ||
    currentTrack.image ||
    'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'

  return (
    <div
      className="fs-player-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Full screen music player"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient Blurred Backdrop with Rich Saturated Glow */}
      <div
        className="fs-ambient-bg"
        style={{ backgroundImage: `url(${artwork})` }}
        aria-hidden="true"
      />
      <div className="fs-backdrop-scrim" aria-hidden="true" />

      <div className="fs-player-content">
        {/* Mobile Swipe Down Pull Handle */}
        <div
          className="fs-drag-handle-wrap"
          onClick={onClose}
          title="Swipe or tap down to minimize"
          aria-label="Minimize full screen player"
        >
          <span className="fs-drag-handle" />
        </div>

        {/* Top Header */}
        <header className="fs-top-bar">
          <button
            className="fs-icon-btn"
            onClick={onClose}
            title="Minimize (Esc)"
            aria-label="Minimize full screen player"
          >
            <ChevronDown size={28} />
          </button>

          <div className="fs-header-meta">
            <span className="fs-header-sub">NOW PLAYING</span>
            <span className="fs-header-title">{currentTrack.album?.name || 'Single'}</span>
          </div>

          <div style={{ width: 44, height: 44 }} aria-hidden="true" />
        </header>

        {/* Center Stage: Prominent Artwork & Song Info */}
        <div className="fs-center-stage">
          <div className="fs-art-container">
            <img
              src={artwork}
              alt={currentTrack.name || 'Song artwork'}
              className={`fs-album-art ${isPlaying ? 'playing' : ''}`}
            />
          </div>

          <div className="fs-track-details">
            <div className="fs-title-row">
              <div className="fs-text-col">
                <h1 className="fs-track-name">{currentTrack.name}</h1>
                <p className="fs-artist-name">{currentTrack.artist}</p>
              </div>

              <button
                className={`fs-like-btn ${isLiked ? 'liked' : ''}`}
                onClick={() => onToggleLike(currentTrack)}
                title={isLiked ? 'Unlike' : 'Like'}
                aria-label={isLiked ? `Unlike ${currentTrack.name}` : `Like ${currentTrack.name}`}
              >
                <Heart size={26} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Scrubber & Transport */}
        <div className="fs-controls-section">
          {/* Progress Scrubber */}
          <div className="fs-scrub-wrap">
            <div
              className="progress-bar-wrap fs-progress-bar"
              ref={progressBarRef}
              role="slider"
              aria-label="Seek track position"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
            >
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              <div className="progress-handle" style={{ left: `${progressPct}%` }} />
              {hoverTime !== null && (
                <div className="scrub-tooltip" style={{ left: `${hoverPos}px` }}>
                  {formatDuration(hoverTime)}
                </div>
              )}
            </div>
            <div className="fs-time-row">
              <span className="time-code">{formatDuration(currentTime)}</span>
              <span className="time-code">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Master Transport Buttons */}
          <div className="fs-transport-row">
            <button
              className={`fs-icon-btn ${shuffle ? 'active' : ''}`}
              onClick={onToggleShuffle}
              title={shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
              aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle size={20} />
            </button>

            <button
              className="fs-icon-btn"
              onClick={onPlayPrev}
              title="Previous Track"
              aria-label="Previous track"
            >
              <SkipBack size={26} />
            </button>

            <button
              className="fs-play-btn"
              onClick={onTogglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause track' : 'Play track'}
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
            </button>

            <button
              className="fs-icon-btn"
              onClick={onPlayNext}
              title="Next Track"
              aria-label="Next track"
            >
              <SkipForward size={26} />
            </button>

            <button
              className={`fs-icon-btn ${repeat !== 'none' ? 'active' : ''}`}
              onClick={onToggleRepeat}
              title={repeat === 'one' ? 'Repeat One' : repeat === 'all' ? 'Repeat All' : 'Repeat Off'}
              aria-label={`Repeat mode: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          {/* Bottom Utility Tools */}
          <div className="fs-utility-row">
            <div
              className={`animated-wave-eq fs-visualizer ${isPlaying ? 'playing' : ''}`}
              aria-hidden="true"
              title="Audio visualizer"
            >
              <span className="eq-bar bar-1" />
              <span className="eq-bar bar-2" />
              <span className="eq-bar bar-3" />
              <span className="eq-bar bar-4" />
            </div>

            <div className="fs-vol-box">
              <button
                className="fs-icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
                title={volume === 0 ? 'Unmute' : 'Mute'}
                aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="vol-slider"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                title={`Volume: ${Math.round(volume * 100)}%`}
                aria-label="Volume slider"
              />
            </div>

            <div className="fs-actions-right">
              <button
                className="fs-icon-btn"
                onClick={onToggleQueue}
                title="Queue"
                aria-label="Open playback queue"
              >
                <ListMusic size={22} />
              </button>

              <button
                className={`fs-icon-btn ${isDownloading ? 'downloading' : ''}`}
                onClick={() => onDownload(currentTrack)}
                disabled={isDownloading}
                title="Download Song"
                aria-label="Download song"
              >
                {isDownloading ? <Loader2 size={22} className="spin-loader" /> : <Download size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
