import React from 'react'
import { decodeHtmlEntities } from '../utils/helpers.js'

export function MusicCard({ item, type, onClick }) {
  const img =
    (item.image && item.image[item.image.length - 1] && item.image[item.image.length - 1].url) ||
    (typeof item.image === 'string' ? item.image : '')
  const title = decodeHtmlEntities(item.name || item.title || '')
  const desc = decodeHtmlEntities(
    item.subtitle ||
      (item.artists && item.artists.primary && item.artists.primary[0] && item.artists.primary[0].name) ||
      item.artist ||
      item.type ||
      ''
  )
  const badge =
    type === 'albums'
      ? item.year || 'Album'
      : type === 'playlists'
        ? item.songCount
          ? item.songCount + ' tracks'
          : 'Playlist'
        : type === 'artists'
          ? 'Artist'
          : ''

  return (
    <div
      className="music-card"
      role="button"
      tabIndex={0}
      aria-label={`${title} (${badge || type})`}
      onClick={() => onClick(item.id, type)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(item.id, type)
        }
      }}
    >
      <div className="card-cover-wrap">
        <img className="card-cover" src={img} alt={`${title} cover`} loading="lazy" decoding="async" />
        {badge && <span className="card-badge">{badge}</span>}
      </div>
      <div className="card-title">{title}</div>
      <div className="card-desc">{desc}</div>
    </div>
  )
}
