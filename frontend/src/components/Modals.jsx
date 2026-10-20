import React, { useState } from 'react'
import { X } from 'lucide-react'

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
          <button className="drawer-close" onClick={onClose} aria-label="Close Audio Quality dialog">
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: 8,
              letterSpacing: '0.05em'
            }}
          >
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

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 8,
            letterSpacing: '0.05em'
          }}
        >
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
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onSetQuality(selected, mode)}>
            Save
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
    { key: 'Q', desc: 'Toggle Queue' },
    { key: 'S', desc: 'Toggle Shuffle' },
    { key: 'R', desc: 'Toggle Repeat' },
    { key: 'Esc', desc: 'Close Modals & Drawers' }
  ]

  return (
    <div className="modal-wrap open" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Keyboard Shortcuts</div>
          <button className="drawer-close" onClick={onClose} aria-label="Close Keyboard Shortcuts dialog">
            <X size={16} />
          </button>
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
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
