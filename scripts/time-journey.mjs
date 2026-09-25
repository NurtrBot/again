#!/usr/bin/env node
/* Times a real generation through the running app (uses whatever providers are configured):
 * sign in → upload → draft (pre-plan fires) → wait N s as if the user were choosing → Animate → ready.
 * Usage: node scripts/time-journey.mjs [baseUrl] [photo] [thinkSeconds] */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const base = process.argv[2] ?? 'http://localhost:3100';
const photo = process.argv[3] ?? 'handoff/fixtures/restaurant-source.jpeg';
const think = Number(process.argv[4] ?? 20);
let cookie = '';
const api = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, json: await res.json().catch(() => null) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const email = process.argv[5] ?? `timing-${Date.now()}@example.com`;
let r = await api('POST', '/api/v1/auth/otp', { email });
r = await api('POST', '/api/v1/auth/verify', { challengeId: r.json.challengeId, code: r.json.demoCode });
await api('PATCH', '/api/v1/me', { onboardingComplete: true });
const bytes = readFileSync(photo);
const T = Date.now();
r = await api('POST', '/api/v1/uploads', { filename: 'photo.jpg', contentType: 'image/jpeg', byteLength: bytes.length });
await fetch(r.json.uploadUrl, { method: 'PUT', headers: r.json.headers, body: bytes });
const mediaId = r.json.mediaId;
r = await api('POST', `/api/v1/uploads/${mediaId}/complete`);
while (r.json.status !== 'ready' && r.json.status !== 'rejected') {
  await sleep(400);
  r = await api('GET', `/api/v1/uploads/${mediaId}`);
}
console.log(`upload+normalize: ${stamp(T)}`);
r = await api('POST', '/api/v1/drafts', { mediaId });
const draft = r.json;
console.log(`draft ready (pre-plan queued): ${stamp(T)}; simulating ${think}s on the Direction screen`);
await sleep(think * 1000);
const T1 = Date.now();
r = await api('POST', '/api/v1/generations', { draftId: draft.id, expectedDraftVersion: draft.version }, { 'Idempotency-Key': randomUUID() });
if (r.status !== 202) {
  console.error('generation not accepted', r.status, r.json);
  process.exit(1);
}
const job = r.json;
let last = '';
for (;;) {
  await sleep(1000);
  r = await api('GET', `/api/v1/generations/${job.id}`);
  if (r.json.status !== last) {
    console.log(`${stamp(T1)} after Animate: ${r.json.status}`);
    last = r.json.status;
  }
  if (['ready', 'failed', 'abandoned'].includes(r.json.status)) break;
}
console.log(`RESULT: ${r.json.status} in ${stamp(T1)} after Animate (credit ${r.json.creditState})`);
