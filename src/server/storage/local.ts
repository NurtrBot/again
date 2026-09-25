import { mkdir, readFile, stat, unlink, writeFile, copyFile, open } from 'node:fs/promises';
import { dirname, resolve, normalize } from 'node:path';
import { getEnv } from '../env';
import { hmacHex, safeEqual } from '@/src/domain/helpers';
import type { Bucket, SignedUpload, StorageDriver } from './index';

/** Private on-disk storage under LOCAL_MEDIA_DIR with HMAC-signed, expiring URLs. */
export class LocalStorage implements StorageDriver {
  readonly name = 'local' as const;
  private root: string;
  constructor() {
    this.root = resolve(process.cwd(), getEnv().LOCAL_MEDIA_DIR);
  }
  private path(bucket: Bucket, key: string) {
    const p = resolve(this.root, bucket, normalize(key));
    if (!p.startsWith(resolve(this.root, bucket) + '/')) throw new Error('INVALID_OBJECT_KEY');
    return p;
  }
  private sign(kind: 'put' | 'get', bucket: Bucket, key: string, exp: number, extra = '') {
    return hmacHex(getEnv().APP_SECRET, `${kind}:${bucket}:${key}:${exp}:${extra}`);
  }
  verify(kind: 'put' | 'get', bucket: Bucket, key: string, exp: number, sig: string, extra = ''): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    return safeEqual(sig, this.sign(kind, bucket, key, exp, extra));
  }
  async createSignedUpload(bucket: Bucket, key: string, opts: { contentType: string; byteLength: number; ttlSeconds: number }): Promise<SignedUpload> {
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    const extra = `${opts.contentType}:${opts.byteLength}`;
    const sig = this.sign('put', bucket, key, exp, extra);
    const url = `${getEnv().APP_URL}/media/${bucket}/${encodeURI(key)}?exp=${exp}&sig=${sig}&len=${opts.byteLength}&ct=${encodeURIComponent(opts.contentType)}`;
    return { url, headers: { 'Content-Type': opts.contentType }, expiresAt: new Date(exp * 1000) };
  }
  async signedReadUrl(bucket: Bucket, key: string, opts: { ttlSeconds: number; download?: string | null }) {
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    const sig = this.sign('get', bucket, key, exp);
    const dl = opts.download ? `&dl=${encodeURIComponent(opts.download)}` : '';
    return `/media/${bucket}/${encodeURI(key)}?exp=${exp}&sig=${sig}${dl}`;
  }
  async providerReadUrl(bucket: Bucket, key: string, ttlSeconds: number) {
    const base = getEnv().PUBLIC_MEDIA_BASE_URL;
    if (!base.startsWith('https://')) return null;
    const rel = await this.signedReadUrl(bucket, key, { ttlSeconds });
    return `${base.replace(/\/$/, '')}${rel}`;
  }
  async head(bucket: Bucket, key: string) {
    try {
      const s = await stat(this.path(bucket, key));
      return { byteLength: s.size, contentType: null };
    } catch {
      return null;
    }
  }
  async read(bucket: Bucket, key: string) {
    return readFile(this.path(bucket, key));
  }
  async readRange(bucket: Bucket, key: string, start: number, end: number) {
    const fh = await open(this.path(bucket, key), 'r');
    try {
      const len = end - start + 1;
      const buf = Buffer.alloc(len);
      const { bytesRead } = await fh.read(buf, 0, len, start);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }
  async write(bucket: Bucket, key: string, data: Buffer) {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async writeFromFile(bucket: Bucket, key: string, filePath: string) {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await copyFile(filePath, p);
  }
  async delete(bucket: Bucket, key: string) {
    try {
      await unlink(this.path(bucket, key));
    } catch (e) {
      if ((e as { code?: string }).code !== 'ENOENT') throw e;
    }
  }
  absolutePath(bucket: Bucket, key: string) {
    return this.path(bucket, key);
  }
}
