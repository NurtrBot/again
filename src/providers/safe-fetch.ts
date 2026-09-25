import { createWriteStream } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export class UnsafeUrl extends Error {}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

export interface SafeFetchOptions {
  allowedHosts: string[]; // exact hostnames or suffixes starting with '.'
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

function hostAllowed(host: string, allowed: string[]): boolean {
  if (!allowed.length) return false;
  return allowed.some((a) => (a.startsWith('.') ? host.endsWith(a) || host === a.slice(1) : host === a));
}

/**
 * Downloads an HTTPS resource to disk with host allowlist, private-IP rejection, manual
 * redirect revalidation, byte cap and timeout. Never forwards Authorization headers.
 */
export async function safeDownload(url: string, dest: string, opts: SafeFetchOptions): Promise<{ bytes: number; contentType: string | null; finalUrl: string }> {
  let current = url;
  const maxRedirects = opts.maxRedirects ?? 3;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'https:') throw new UnsafeUrl(`non-https url`);
    if (u.username || u.password) throw new UnsafeUrl('credentials in url');
    if (!hostAllowed(u.hostname, opts.allowedHosts)) throw new UnsafeUrl(`host not allowed: ${u.hostname}`);
    if (isIP(u.hostname)) throw new UnsafeUrl('ip literal');
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrl('resolves to private address');
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000), headers: { Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.5' } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new UnsafeUrl('redirect without location');
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`DOWNLOAD_HTTP_${res.status}`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > opts.maxBytes) throw new Error('DOWNLOAD_TOO_LARGE');
    let bytes = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > opts.maxBytes) controller.error(new Error('DOWNLOAD_TOO_LARGE'));
        else controller.enqueue(chunk);
      },
    });
    await pipeline(Readable.fromWeb(res.body.pipeThrough(counter) as never), createWriteStream(dest));
    return { bytes, contentType: res.headers.get('content-type'), finalUrl: current };
  }
  throw new UnsafeUrl('too many redirects');
}
