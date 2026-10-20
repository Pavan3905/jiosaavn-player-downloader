import React from 'react'

export function FilterBar({ activeScope, onScopeChange }) {
  const scopes = [
    { id: 'songs', label: 'Tracks' },
    { id: 'albums', label: 'Albums' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'artists', label: 'Artists' }
  ]

  return (
    <section className="filter-bar">
      <div className="chips-row">
        {scopes.map((s) => (
          <button
            key={s.id}
            className={`chip ${activeScope === s.id ? 'active' : ''}`}
            onClick={() => onScopeChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  )
}
