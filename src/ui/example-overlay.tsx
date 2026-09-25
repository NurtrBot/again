'use client';
import { Close } from './icons';

/** Labeled example player. Sample renders are demo pushes of a still, never a user film. */
export function ExampleOverlay({ src, onClose, label = 'Example · demo render, not a user film' }: { src: string; onClose: () => void; label?: string }) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Example film" onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div className="row-between" style={{ marginBottom: 8, color: '#fff' }}>
            <span className="mono">{label}</span>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} style={{ color: '#fff' }}>
              <Close />
            </button>
          </div>
          <video src={src} controls autoPlay playsInline style={{ width: '100%', borderRadius: 4, background: '#000' }} />
        </div>
      </div>
    </div>
  );
}
