'use client';
import { api, ApiFailure } from './api';
import type { Media } from '@/src/domain/types';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
export const MAX_BYTES = 20 * 1024 * 1024;

export type LocalValidation = { ok: true; contentType: string } | { ok: false; code: 'unsupported_type' | 'too_large' };

/** Cheap local checks; the server re-validates real bytes. */
export function validateLocally(file: File): LocalValidation {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  let type = file.type.toLowerCase();
  if (!type) {
    if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
    else if (ext === 'png') type = 'image/png';
    else if (ext === 'heic') type = 'image/heic';
    else if (ext === 'heif') type = 'image/heif';
  }
  if (!ACCEPTED_TYPES.includes(type)) return { ok: false, code: 'unsupported_type' };
  if (file.size > MAX_BYTES) return { ok: false, code: 'too_large' };
  return { ok: true, contentType: type };
}

export interface UploadProgress {
  phase: 'requesting' | 'uploading' | 'validating' | 'ready' | 'error';
  bytesSent?: number;
  bytesTotal?: number;
  errorCode?: string;
}

/** Full upload pipeline: ticket -> PUT bytes -> complete -> poll until ready. */
export async function uploadPhoto(
  file: Blob,
  filename: string,
  contentType: string,
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<Media> {
  onProgress({ phase: 'requesting' });
  const ticket = await api.uploads.create({ filename, contentType, byteLength: file.size });
  onProgress({ phase: 'uploading', bytesSent: 0, bytesTotal: file.size });
  await putWithProgress(ticket.uploadUrl, ticket.headers, file, (sent) => onProgress({ phase: 'uploading', bytesSent: sent, bytesTotal: file.size }), signal);
  onProgress({ phase: 'validating' });
  let media = await api.uploads.complete(ticket.mediaId);
  const deadline = Date.now() + 90_000;
  let wait = 500;
  while (media.status === 'pending' || media.status === 'validating') {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (Date.now() > deadline) throw new ApiFailure(504, { error: { code: 'validation_timeout', message: 'Validation timed out', requestId: '', retryable: true, fieldErrors: {} } });
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(2000, wait * 1.5);
    media = await api.uploads.get(ticket.mediaId);
  }
  if (media.status === 'rejected') {
    onProgress({ phase: 'error', errorCode: media.errorCode ?? 'unreadable' });
    throw new ApiFailure(422, { error: { code: media.errorCode ?? 'unreadable', message: 'Photo rejected', requestId: '', retryable: false, fieldErrors: {} } });
  }
  onProgress({ phase: 'ready' });
  return media;
}

function putWithProgress(url: string, headers: Record<string, string>, body: Blob, onSent: (n: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onSent(e.loaded);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiFailure(xhr.status, safeJson(xhr.responseText))));
    xhr.onerror = () => reject(new ApiFailure(0, { error: { code: 'upload_interrupted', message: 'Upload failed', requestId: '', retryable: true, fieldErrors: {} } }));
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
