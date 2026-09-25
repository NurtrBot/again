import { del, get, head, issueSignedToken, presignUrl, put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { getEnv } from '../env';
import type { Bucket, SignedUpload, StorageDriver } from './index';

/**
 * Vercel Blob driver. Every object is a PRIVATE blob under `<bucket>/<key>`.
 * Browsers upload straight to Blob with a short-lived presigned PUT (no 4.5 MB function body limit),
 * and read through short-lived presigned GET URLs. Providers fetch the same presigned GET URLs.
 */
export class BlobStorage implements StorageDriver {
  readonly name = 'blob' as const;
  private token: string;
  constructor() {
    const t = process.env.BLOB_READ_WRITE_TOKEN;
    if (!t) throw new Error('BLOB_READ_WRITE_TOKEN_MISSING');
    this.token = t;
  }
  private path(bucket: Bucket, key: string) {
    if (key.includes('..') || key.startsWith('/')) throw new Error('INVALID_OBJECT_KEY');
    return `${bucket}/${key}`;
  }
  async createSignedUpload(bucket: Bucket, key: string, opts: { contentType: string; byteLength: number; ttlSeconds: number }): Promise<SignedUpload> {
    const pathname = this.path(bucket, key);
    const validUntil = Date.now() + opts.ttlSeconds * 1000;
    const signed = await issueSignedToken({ token: this.token, pathname, operations: ['put'], validUntil, allowedContentTypes: [opts.contentType], maximumSizeInBytes: opts.byteLength });
    const { presignedUrl } = await presignUrl(signed, { operation: 'put', pathname, access: 'private', validUntil, allowedContentTypes: [opts.contentType], maximumSizeInBytes: opts.byteLength, allowOverwrite: false, addRandomSuffix: false });
    return { url: presignedUrl, headers: { 'Content-Type': opts.contentType, 'x-content-type': opts.contentType }, expiresAt: new Date(validUntil) };
  }
  async signedReadUrl(bucket: Bucket, key: string, opts: { ttlSeconds: number; download?: string | null }) {
    const pathname = this.path(bucket, key);
    const validUntil = Date.now() + opts.ttlSeconds * 1000;
    const signed = await issueSignedToken({ token: this.token, pathname, operations: ['get'], validUntil });
    const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname, access: 'private', validUntil });
    if (opts.download) {
      const u = new URL(presignedUrl);
      u.searchParams.set('download', '1');
      return u.toString();
    }
    return presignedUrl;
  }
  async providerReadUrl(bucket: Bucket, key: string, ttlSeconds: number) {
    return this.signedReadUrl(bucket, key, { ttlSeconds });
  }
  async head(bucket: Bucket, key: string) {
    try {
      const h = await head(this.path(bucket, key), { token: this.token });
      return { byteLength: h.size, contentType: h.contentType ?? null };
    } catch (err) {
      if (/not found|404|does not exist/i.test((err as Error).message)) return null;
      throw err;
    }
  }
  async read(bucket: Bucket, key: string) {
    const r = await get(this.path(bucket, key), { access: 'private', token: this.token, useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) throw new Error('STORAGE_READ_FAILED');
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  async write(bucket: Bucket, key: string, data: Buffer, contentType: string) {
    await put(this.path(bucket, key), data, { access: 'private', token: this.token, contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  async writeFromFile(bucket: Bucket, key: string, filePath: string, contentType: string) {
    await this.write(bucket, key, await readFile(filePath), contentType);
  }
  async delete(bucket: Bucket, key: string) {
    await del(this.path(bucket, key), { token: this.token });
  }
}
