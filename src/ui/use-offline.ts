'use client';
import { useEffect, useState } from 'react';

/** True while the browser reports no network. Paid mutations must not be queued while offline. */
export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline;
}
