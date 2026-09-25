'use client';
import { useEffect, useRef } from 'react';
import type { JobStatus } from '@/src/domain/types';

/**
 * Builds the photo up from a blank canvas, tile by tile, paced by real elapsed time against the
 * expected duration. Eases toward ~90% (never claims done); jumps to full only when the job is ready.
 * Decorative: no percentage is ever shown or implied as truth.
 */
export function RevealCanvas({
  src,
  alt,
  startedAt,
  expectedSeconds,
  status,
  fixedProgress,
  tile = 10,
}: {
  src: string;
  alt: string;
  startedAt: string;
  expectedSeconds: number;
  status: JobStatus;
  /** Review/screenshot mode: freeze at this progress. */
  fixedProgress?: number;
  tile?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    let raf = 0;
    let cancelled = false;
    let order: number[] = [];
    let drawn = 0;
    let cols = 0;
    let rows = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const target = (): number => {
      if (fixedProgress !== undefined) return fixedProgress;
      const s = statusRef.current;
      if (s === 'ready') return 1;
      if (reduced) return 1;
      const elapsed = Math.max(0, (Date.now() - Date.parse(startedAt)) / 1000);
      const x = elapsed / Math.max(30, expectedSeconds);
      // Eases in, approaches 0.9 asymptotically; validating_output lifts the ceiling to 0.97.
      const ceiling = s === 'validating_output' ? 0.97 : 0.9;
      const eased = 1 - Math.exp(-1.6 * x) * (1 + 1.6 * x); // smooth start, saturates
      return Math.min(ceiling, ceiling * eased + (s === 'validating_output' ? 0.05 : 0));
    };

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a2bb0';
      ctx.fillRect(0, 0, w, h);
      cols = Math.ceil(w / tile);
      rows = Math.ceil(h / tile);
      // Deterministic shuffle so refreshes look continuous.
      order = Array.from({ length: cols * rows }, (_, i) => i);
      let seed = 1337;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      drawn = 0;
    };

    // object-fit: cover mapping from image to canvas
    const coverRect = () => {
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = w / h;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (ir > cr) sw = Math.round(img.naturalHeight * cr);
      else sh = Math.round(img.naturalWidth / cr);
      return { sx: Math.round((img.naturalWidth - sw) / 2), sy: Math.round((img.naturalHeight - sh) / 2), sw, sh };
    };

    const frame = () => {
      if (cancelled) return;
      const ctx = canvas.getContext('2d')!;
      const want = Math.floor(target() * order.length);
      if (want > drawn && img.complete && img.naturalWidth) {
        const { sx, sy, sw, sh } = coverRect();
        const scaleX = sw / w;
        const scaleY = sh / h;
        const end = Math.min(order.length, want);
        for (let i = drawn; i < end; i++) {
          const idx = order[i];
          const cx = (idx % cols) * tile;
          const cy = Math.floor(idx / cols) * tile;
          const tw = Math.min(tile, w - cx);
          const th = Math.min(tile, h - cy);
          ctx.drawImage(img, sx + cx * scaleX, sy + cy * scaleY, tw * scaleX, th * scaleY, cx, cy, tw, th);
        }
        drawn = end;
        canvas.dataset.drawn = '1';
      }
      if (drawn < order.length) raf = window.setTimeout(() => requestAnimationFrame(frame), 80) as unknown as number;
    };

    const start = () => {
      setup();
      frame();
    };
    if (img.complete && img.naturalWidth) start();
    else img.onload = start;
    const ro = new ResizeObserver(() => {
      if (!img.naturalWidth) return;
      setup();
      frame();
    });
    ro.observe(canvas);
    return () => {
      cancelled = true;
      clearTimeout(raf);
      ro.disconnect();
    };
  }, [src, startedAt, expectedSeconds, fixedProgress, tile]);

  return <canvas ref={canvasRef} role="img" aria-label={alt} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
