'use client';
import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'ink' | 'cobalt';
  action?: { label: string; href: string };
}

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let seq = 1;

export function toast(text: string, opts: { tone?: 'ink' | 'cobalt'; action?: { label: string; href: string } } = {}) {
  const msg: ToastMessage = { id: seq++, text, ...opts };
  listeners.forEach((l) => l(msg));
}

export function ToastRegion() {
  const [items, setItems] = useState<ToastMessage[]>([]);
  useEffect(() => {
    const l: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4200);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!items.length) return <div className="toast-region" aria-live="polite" />;
  return (
    <div className="toast-region" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'cobalt' ? ' toast--cobalt' : ''}`} role="status">
          <span className="grow">{t.text}</span>
          {t.action ? (
            <a className="toast__action" href={t.action.href}>
              {t.action.label}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
