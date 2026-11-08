import React from 'react'
import { Music2, Search, Sun, Moon, X } from 'lucide-react'

export function Header({
  searchInputValue,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  searchType,
  onSearchTypeChange,
  isHome,
  theme,
  onToggleTheme,
  searchInputRef
}) {
  const searchTypes = [
    { id: 'songs', label: 'Songs' },
    { id: 'albums', label: 'Albums' },
    { id: 'artists', label: 'Artists' },
    { id: 'playlists', label: 'Playlists' }
  ]

  return (
    <header className="top-header">
      <div className="header-brand-row">
        <a className="brand-lockup" href="/" aria-label="Saavn home">
          <span className="brand-mark"><Music2 size={19} /></span>
          <span className="brand-name">saavn</span>
        </a>
        <div className="top-controls">
          <button
            className="btn-pill"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span className="btn-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      <div className={`search-hero ${isHome ? 'home-search-hero' : 'compact-search-hero'}`}>
        <form className="search-box" onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}>
          <Search className="search-icon" size={19} />
          <input
            ref={searchInputRef}
            type="search"
            className="search-input"
            placeholder={`Search ${searchType}...`}
            aria-label={`Search ${searchType}`}
            value={searchInputValue}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
          {searchInputValue && (
            <button type="button" className="search-clear" onClick={onSearchClear} title="Clear" aria-label="Clear search input">
              <X size={16} />
            </button>
          )}
          <span className="search-shortcut-badge">/</span>
          <button className="search-submit" type="submit">
            <Search size={16} />
            <span>Search</span>
          </button>
        </form>

        <div className="search-categories" role="tablist" aria-label="Search category">
          {searchTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              role="tab"
              aria-selected={searchType === type.id}
              className={`search-category ${searchType === type.id ? 'active' : ''}`}
              onClick={() => onSearchTypeChange(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
