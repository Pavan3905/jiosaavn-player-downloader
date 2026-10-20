import React, { useState } from 'react'
import { X } from 'lucide-react'

export function EqualizerModal({ isOpen, onClose, eqBandsState, onBandChange, onPresetApply }) {
  if (!isOpen) return null

  const presets = [
    { id: 'flat', label: 'Flat', vals: { 60: 0, 250: 0, 1000: 0, 4000: 0, 12000: 0 } },
    { id: 'bass', label: 'Bass Boost', vals: { 60: 6, 250: 4, 1000: 0, 4000: -1, 12000: -2 } },
    { id: 'vocal', label: 'Vocal', vals: { 60: -3, 250: 0, 1000: 4, 4000: 5, 12000: 2 } },
    { id: 'electronic', label: 'Electronic', vals: { 60: 5, 250: 3, 1000: -1, 4000: 2, 12000: 4 } },
    { id: 'rock', label: 'Rock', vals: { 60: 4, 250: 2, 1000: -2, 4000: 3, 12000: 4 } },
    { id: 'acoustic', label: 'Acoustic', vals: { 60: 3, 250: 2, 1000: 1, 4000: 3, 12000: 3 } }
  ]

  const freqs = [60, 250, 1000, 4000, 12000]

  return (
    <div className="modal-wrap open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Parametric Equalizer</div>
          <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="eq-presets">
          {presets.map((p) => (
            <button
              key={p.id}
              className="eq-preset-btn"
              onClick={() => onPresetApply(p.vals)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="eq-sliders">
          {freqs.map((f) => (
            <div key={f} className="eq-band">
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={eqBandsState[f] || 0}
                onChange={(e) => onBandChange(f, parseFloat(e.target.value))}
                className="eq-slider"
              />
              <span className="eq-freq">{f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`}</span>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={() => onPresetApply({ 60: 0, 250: 0, 1000: 0, 4000: 0, 12000: 0 })}
          >
            Reset
          </button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

export function SleepTimerModal({ isOpen, onClose, currentTimer, onSetTimer }) {
  const [selected, setSelected] = useState(currentTimer || '0')
  if (!isOpen) return null

  const options = [
    { value: '0', label: 'Off', desc: 'Continuous playback' },
    { value: 'end-track', label: 'End of Track', desc: 'Stop after the current track completes' },
    { value: '15', label: '15 Minutes', desc: 'Fade out and pause after 15 minutes' },
    { value: '30', label: '30 Minutes', desc: 'Fade out and pause after 30 minutes' },
    { value: '45', label: '45 Minutes', desc: 'Fade out and pause after 45 minutes' },
    { value: '60', label: '60 Minutes', desc: 'Fade out and pause after 1 hour' }
  ]

  return (
    <div className="modal-wrap open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Sleep Timer</div>
          <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="radio-group">
          {options.map((opt) => (
            <label key={opt.value} className="radio-card">
              <input
                type="radio"
                name="sleep-timer"
                value={opt.value}
                checked={selected === opt.value}
                onChange={(e) => setSelected(e.target.value)}
              />
              <div>
                <strong>{opt.label}</strong>
                <small>{opt.desc}</small>
              </div>
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSetTimer(selected)}>Set Timer</button>
        </div>
      </div>
    </div>
  )
}

export function QualityModal({ isOpen, onClose, currentQuality, currentStreamMode, onSetQuality }) {
  const [selected, setSelected] = useState(currentQuality || '320kbps')
  const [mode, setMode] = useState(currentStreamMode || 'proxy')
  if (!isOpen) return null

  const qualities = [
    { value: '320kbps', label: '320 kbps (Extreme)', desc: 'Highest fidelity AAC studio master' },
    { value: '160kbps', label: '160 kbps (High)', desc: 'Optimal balance of sound quality and data usage' },
    { value: '96kbps', label: '96 kbps (Medium)', desc: 'Standard data saver audio quality' },
    { value: '48kbps', label: '48 kbps (Low)', desc: 'Low data usage for slow connections' },
    { value: '12kbps', label: '12 kbps (Ultra-saver)', desc: 'Minimum bandwidth consumption' }
  ]

  return (
    <div className="modal-wrap open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Audio Quality & Stream Mode</div>
          <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
            Stream Source Mode
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="radio-card" style={{ padding: '8px 12px' }}>
              <input
                type="radio"
                name="stream-mode"
                value="proxy"
                checked={mode === 'proxy'}
                onChange={() => setMode('proxy')}
              />
              <div>
                <strong style={{ fontSize: 12 }}>Proxy Mode (Default)</strong>
                <small style={{ fontSize: 10 }}>Bypasses ISP blocks & CORS</small>
              </div>
            </label>
            <label className="radio-card" style={{ padding: '8px 12px' }}>
              <input
                type="radio"
                name="stream-mode"
                value="direct"
                checked={mode === 'direct'}
                onChange={() => setMode('direct')}
              />
              <div>
                <strong style={{ fontSize: 12 }}>Direct CDN</strong>
                <small style={{ fontSize: 10 }}>Lowest latency playback</small>
              </div>
            </label>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
          Bitrate Quality
        </div>
        <div className="radio-group">
          {qualities.map((q) => (
            <label key={q.value} className="radio-card">
              <input
                type="radio"
                name="stream-quality"
                value={q.value}
                checked={selected === q.value}
                onChange={(e) => setSelected(e.target.value)}
              />
              <div>
                <strong>{q.label}</strong>
                <small>{q.desc}</small>
              </div>
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSetQuality(selected, mode)}>Save</button>
        </div>
      </div>
    </div>
  )
}

export function DownloadModal({ isOpen, track, onClose, onConfirmDownload, isDownloading, progressText }) {
  const [lyricsMode, setLyricsMode] = useState('embed')
  if (!isOpen || !track) return null

  return (
    <div className="modal-wrap open" onClick={!isDownloading ? onClose : undefined}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Download “{track.name}”</div>
          {!isDownloading && (
            <button className="drawer-close" onClick={onClose}><X size={16} /></button>
          )}
        </div>

        <div className="radio-group">
          <label className="radio-card">
            <input
              type="radio"
              name="dl-lyrics-mode"
              value="embed"
              checked={lyricsMode === 'embed'}
              onChange={(e) => setLyricsMode(e.target.value)}
              disabled={isDownloading}
            />
            <div>
              <strong>Embed synced lyrics into M4A</strong>
              <small>Includes cover artwork and lyrics directly inside the audio file.</small>
            </div>
          </label>
          <label className="radio-card">
            <input
              type="radio"
              name="dl-lyrics-mode"
              value="separate"
              checked={lyricsMode === 'separate'}
              onChange={(e) => setLyricsMode(e.target.value)}
              disabled={isDownloading}
            />
            <div>
              <strong>Download a separate .LRC file</strong>
              <small>Save synchronized lyrics beside the tagged M4A file.</small>
            </div>
          </label>
          <label className="radio-card">
            <input
              type="radio"
              name="dl-lyrics-mode"
              value="none"
              checked={lyricsMode === 'none'}
              onChange={(e) => setLyricsMode(e.target.value)}
              disabled={isDownloading}
            />
            <div>
              <strong>Don’t include lyrics</strong>
              <small>Download tagged M4A with metadata and artwork only.</small>
            </div>
          </label>
        </div>

        {progressText && (
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 14 }}>
            {progressText}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isDownloading}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onConfirmDownload(track, lyricsMode)}
            disabled={isDownloading}
          >
            {isDownloading ? 'Processing...' : 'Download M4A'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause' },
    { key: '/', desc: 'Focus Search' },
    { key: '← / →', desc: 'Seek -5s / +5s' },
    { key: '↑ / ↓', desc: 'Volume Up / Down' },
    { key: 'M', desc: 'Mute / Unmute' },
    { key: 'L', desc: 'Toggle Lyrics' },
    { key: 'Q', desc: 'Toggle Queue' },
    { key: 'E', desc: 'Toggle Equalizer' },
    { key: 'S', desc: 'Toggle Shuffle' },
    { key: 'R', desc: 'Toggle Repeat' },
    { key: 'Esc', desc: 'Close Modals & Drawers' }
  ]

  return (
    <div className="modal-wrap open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Keyboard Shortcuts</div>
          <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', fontSize: 13 }}>
          {shortcuts.map((s) => (
            <div key={s.key}>
              <code style={{ color: 'var(--accent)', marginRight: 8, fontFamily: 'var(--font-mono)' }}>
                {s.key}
              </code>
              {s.desc}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
