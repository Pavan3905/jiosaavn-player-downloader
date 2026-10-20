import React, { useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Download,
  Maximize2,
  Loader2
} from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

export function Player({
  currentTrack,
  isPlaying,
  shuffle,
  repeat,
  volume,
  currentTime,
  duration,
  onTogglePlayPause,
  onPlayPrev,
  onPlayNext,
  onToggleShuffle,
  onToggleRepeat,
  onSeek,
  onVolumeChange,
  onDownload,
  onOpenFullScreen,
  isDownloading
}) {
  const progressBarRef = useRef(null)
  const [hoverTime, setHoverTime] = React.useState(null)
  const [hoverPos, setHoverPos] = React.useState(0)
  const isDraggingRef = useRef(false)

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
    e.currentTarget.setPointerCapture?.(e.pointerId)
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

  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isSlider: false })

  const handleTouchStart = (e) => {
    if (!currentTrack) return
    const touch = e.touches[0]
    const isSlider = !!e.target.closest('.progress-bar-wrap, .vol-slider')
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isSlider
    }
  }

  const handleTouchEnd = (e) => {
    if (!currentTrack || touchStartRef.current.isSlider) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const elapsed = Date.now() - touchStartRef.current.time

    // Swipe Up: finger moved up by at least 35px
    if (deltaY < -35 && Math.abs(deltaY) > Math.abs(deltaX) && elapsed < 800) {
      onOpenFullScreen?.()
    }
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <footer
      className="player-bar"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="mobile-swipe-indicator"
        aria-hidden="true"
        onClick={() => currentTrack && onOpenFullScreen?.()}
        title="Swipe up for Full Screen"
      >
        <span className="swipe-bar" />
      </div>
      <div
        className="now-playing-meta"
        onClick={() => currentTrack && onOpenFullScreen?.()}
        style={{ cursor: currentTrack ? 'pointer' : 'default' }}
        title={currentTrack ? 'Click to open Full Screen Player' : ''}
      >
        {currentTrack ? (
          <>
            <img
              className="now-playing-cover"
              src={currentTrack.image || 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
              alt={currentTrack.name || 'Now playing song'}
            />
            <div className="now-playing-text">
              <div className="now-playing-title">{currentTrack.name}</div>
              <div className="now-playing-artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div className="now-playing-text">
            <div className="now-playing-title" style={{ color: 'var(--text-muted)' }}>
              No track playing
            </div>
            <div className="now-playing-artist">Select a song to start listening</div>
          </div>
        )}
      </div>

      <div className="transport-wrap">
        <div className="transport-controls">
          <button
            className={`transport-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
            aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
          >
            <Shuffle size={16} />
          </button>
          <button className="transport-btn" onClick={onPlayPrev} title="Previous" aria-label="Previous track">
            <SkipBack size={18} />
          </button>
          <button
            className="btn-play-master"
            onClick={onTogglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause track' : 'Play track'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="transport-btn" onClick={onPlayNext} title="Next" aria-label="Next track">
            <SkipForward size={18} />
          </button>
          <button
            className={`transport-btn ${repeat !== 'none' ? 'active' : ''}`}
            onClick={onToggleRepeat}
            title={repeat === 'one' ? 'Repeat One' : repeat === 'all' ? 'Repeat All' : 'Repeat Off'}
            aria-label={`Repeat mode: ${repeat}`}
          >
            {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div className="scrub-container">
          <span className="time-code">{formatDuration(currentTime)}</span>
          <div
            className="progress-bar-wrap"
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
          <span className="time-code">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="player-tools">
        <div className={`animated-wave-eq ${isPlaying ? 'playing' : ''}`} aria-hidden="true" title="Audio visualizer">
          <span className="eq-bar bar-1" />
          <span className="eq-bar bar-2" />
          <span className="eq-bar bar-3" />
          <span className="eq-bar bar-4" />
        </div>

        <div className="vol-wrap">
          <button
            className="transport-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            title={volume === 0 ? 'Unmute' : 'Mute'}
            aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
          >
            {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
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

        <button
          className="transport-btn btn-action-dl"
          onClick={() => currentTrack && onDownload(currentTrack)}
          disabled={!currentTrack || isDownloading}
          title="Download Song"
          aria-label="Download song"
        >
          {isDownloading ? <Loader2 size={16} className="spin-loader" /> : <Download size={16} />}
        </button>

        <button
          className="transport-btn"
          onClick={onOpenFullScreen}
          disabled={!currentTrack}
          title="Full Screen Music Player"
          aria-label="Open full screen music player"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </footer>
  )
}
