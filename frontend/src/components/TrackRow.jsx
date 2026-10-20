import React from 'react'
import { Play, Pause, Heart, Plus, Download } from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

export function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  isLiked,
  onPlay,
  onToggleLike,
  onAddToQueue,
  onDownload,
  onAlbumClick
}) {
  return (
    <div className={`track-row ${isCurrent ? 'playing' : ''}`}>
      <div className="track-idx">
        <span>{index + 1}</span>
        <button
          className="play-trigger"
          onClick={() => onPlay(track, index)}
          title={isCurrent && isPlaying ? 'Pause' : 'Play'}
        >
          {isCurrent && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>

      <div className="track-main" onClick={() => onPlay(track, index)}>
        <img
          className="track-thumb"
          src={track.image || 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <div className="track-info">
          <div className="track-title">{track.name}</div>
          <div className="track-subtitle">{track.artist}</div>
        </div>
      </div>

      <div
        className="track-album"
        title="View Album"
        onClick={() => track.album?.id && onAlbumClick(track.album.id)}
      >
        {track.album?.name || 'Single'}
      </div>

      <div className="track-duration">{formatDuration(track.duration)}</div>

      <div className="track-actions">
        <button
          className={`row-action-btn btn-like ${isLiked ? 'liked' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleLike(track)
          }}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
        <button
          className="row-action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onAddToQueue(track)
          }}
          title="Add to Queue"
        >
          <Plus size={16} />
        </button>
        <button
          className="row-action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDownload(track)
          }}
          title="Download High-Fidelity Track"
        >
          <Download size={15} />
        </button>
      </div>
    </div>
  )
}
