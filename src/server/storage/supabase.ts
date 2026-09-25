import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { getEnv } from '../env';
import type { Bucket, SignedUpload, StorageDriver } from './index';

/** Private Supabase Storage buckets accessed with the service role (server only). */
export class SupabaseStorage implements StorageDriver {
  readonly name = 'supabase' as const;
  private client: SupabaseClient;
  constructor() {
    const env = getEnv();
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
    this.client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  async createSignedUpload(bucket: Bucket, key: string, opts: { contentType: string; byteLength: number; ttlSeconds: number }): Promise<SignedUpload> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(key);
    if (error || !data) throw new Error(`STORAGE_SIGN_UPLOAD_FAILED: ${error?.message}`);
    return { url: data.signedUrl, headers: { 'Content-Type': opts.contentType, 'x-upsert': 'false' }, expiresAt: new Date(Date.now() + opts.ttlSeconds * 1000) };
  }
  async signedReadUrl(bucket: Bucket, key: string, opts: { ttlSeconds: number; download?: string | null }) {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(key, opts.ttlSeconds, opts.download ? { download: opts.download } : undefined);
    if (error || !data) throw new Error(`STORAGE_SIGN_READ_FAILED: ${error?.message}`);
    return data.signedUrl;
  }
  async providerReadUrl(bucket: Bucket, key: string, ttlSeconds: number) {
    return this.signedReadUrl(bucket, key, { ttlSeconds });
  }
  async head(bucket: Bucket, key: string) {
    const dir = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '';
    const name = key.slice(key.lastIndexOf('/') + 1);
    const { data, error } = await this.client.storage.from(bucket).list(dir, { search: name, limit: 1 });
    if (error || !data?.length) return null;
    const f = data.find((x) => x.name === name);
    if (!f) return null;
    const meta = (f.metadata ?? {}) as { size?: number; mimetype?: string };
    return { byteLength: meta.size ?? 0, contentType: meta.mimetype ?? null };
  }
  async read(bucket: Bucket, key: string) {
    const { data, error } = await this.client.storage.from(bucket).download(key);
    if (error || !data) throw new Error(`STORAGE_READ_FAILED: ${error?.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
  async write(bucket: Bucket, key: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(bucket).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`STORAGE_WRITE_FAILED: ${error.message}`);
  }
  async writeFromFile(bucket: Bucket, key: string, filePath: string, contentType: string) {
    await this.write(bucket, key, await readFile(filePath), contentType);
  }
  async delete(bucket: Bucket, key: string) {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error && !/not found/i.test(error.message)) throw new Error(`STORAGE_DELETE_FAILED: ${error.message}`);
  }
}
