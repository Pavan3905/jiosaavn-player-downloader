import React from 'react'

export function FilterBar({ activeScope, onScopeChange, activeLanguage = 'All', onLanguageChange }) {
  const scopes = [
    { id: 'songs', label: 'Tracks' },
    { id: 'albums', label: 'Albums' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'artists', label: 'Artists' }
  ]

  const languages = ['All', 'Hindi', 'Telugu', 'Punjabi', 'Tamil', 'English']

  return (
    <section className="filter-bar">
      <div className="chips-row">
        {scopes.map((s) => (
          <button
            key={s.id}
            className={`chip ${activeScope === s.id ? 'active' : ''}`}
            onClick={() => onScopeChange(s.id)}
            aria-label={`Filter by ${s.label}`}
            aria-pressed={activeScope === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeScope === 'songs' && onLanguageChange && (
        <div className="lang-chips-row" role="radiogroup" aria-label="Filter tracks by language">
          {languages.map((lang) => (
            <button
              key={lang}
              className={`lang-chip ${activeLanguage === lang ? 'active' : ''}`}
              onClick={() => onLanguageChange(lang)}
              aria-label={`Show ${lang} trending music`}
              aria-checked={activeLanguage === lang}
              role="radio"
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
