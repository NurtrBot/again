import { getEnv } from '../env';
import { LocalStorage } from './local';
import { SupabaseStorage } from './supabase';

export type Bucket = 'sources' | 'normalized' | 'films' | 'thumbnails';
export const BUCKETS: Bucket[] = ['sources', 'normalized', 'films', 'thumbnails'];

export interface SignedUpload {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StorageDriver {
  readonly name: 'local' | 'supabase';
  createSignedUpload(bucket: Bucket, key: string, opts: { contentType: string; byteLength: number; ttlSeconds: number }): Promise<SignedUpload>;
  /** Short-lived read URL for the browser (absolute or same-origin path). */
  signedReadUrl(bucket: Bucket, key: string, opts: { ttlSeconds: number; contentType?: string; download?: string | null }): Promise<string>;
  /** HTTPS URL a third-party provider can fetch (null when not reachable, e.g. local without a public base). */
  providerReadUrl(bucket: Bucket, key: string, ttlSeconds: number): Promise<string | null>;
  head(bucket: Bucket, key: string): Promise<{ byteLength: number; contentType: string | null } | null>;
  read(bucket: Bucket, key: string): Promise<Buffer>;
  readRange?(bucket: Bucket, key: string, start: number, end: number): Promise<Buffer>;
  write(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void>;
  writeFromFile(bucket: Bucket, key: string, filePath: string, contentType: string): Promise<void>;
  delete(bucket: Bucket, key: string): Promise<void>;
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (driver) return driver;
  const env = getEnv();
  driver = env.STORAGE_DRIVER === 'supabase' ? new SupabaseStorage() : new LocalStorage();
  return driver;
}

export function objectKey(userId: string, id: string, ext: string): string {
  return `${userId}/${id}.${ext}`;
}
