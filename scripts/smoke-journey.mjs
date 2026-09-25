#!/usr/bin/env node
/* End-to-end API smoke test against a running dev server + worker (mock providers).
 * Usage: node scripts/smoke-journey.mjs [baseUrl] [photoPath]
 * Exercises: OTP sign-in → onboarding → upload → validation → draft → generation (idempotent) →
 * worker phases → film ready → download → rename → delete. Exits non-zero on any failure. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const base = process.argv[2] ?? 'http://localhost:3100';
const photo = process.argv[3] ?? 'public/samples/restaurant.jpg';
const email = `smoke-${Date.now()}@example.com`;
let cookie = '';

async function api(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, res };
}
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok  ', msg);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. sign in
let r = await api('POST', '/api/v1/auth/otp', { email, returnTo: '/create' });
assert(r.status === 202 && r.json.demoCode, 'otp requested (demo code returned)');
r = await api('POST', '/api/v1/auth/verify', { challengeId: r.json.challengeId, code: r.json.demoCode });
assert(r.status === 200 && r.json.nextPath.startsWith('/onboarding'), `verified, new user → ${r.json.nextPath}`);
r = await api('POST', '/api/v1/auth/verify', { challengeId: 'e2aed3ba-6f4e-4409-b877-2289c620e5e1', code: '000000' });
assert(r.status === 401, 'wrong/consumed code rejected');
r = await api('PATCH', '/api/v1/me', { onboardingComplete: true, displayName: 'Smoke Tester' });
assert(r.status === 200 && r.json.onboardingComplete, 'onboarding complete');
r = await api('GET', '/api/v1/credits');
assert(r.status === 200 && r.json.available >= 1, `credits available: ${r.json.available} (seeded in mock mode)`);
const startCredits = r.json.available;

// 2. upload
const bytes = readFileSync(photo);
r = await api('POST', '/api/v1/uploads', { filename: 'photo.jpg', contentType: 'image/jpeg', byteLength: bytes.length });
assert(r.status === 201 && r.json.uploadUrl, 'upload ticket');
const ticket = r.json;
const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: bytes });
assert(put.status === 200, 'bytes PUT to signed url');
r = await api('POST', `/api/v1/uploads/${ticket.mediaId}/complete`);
assert(r.status === 202 && ['validating', 'ready'].includes(r.json.status), `complete → ${r.json.status}`);
for (let i = 0; i < 40 && r.json.status !== 'ready'; i++) {
  await sleep(500);
  r = await api('GET', `/api/v1/uploads/${ticket.mediaId}`);
  if (r.json.status === 'rejected') break;
}
assert(r.json.status === 'ready', `upload normalized (${r.json.width}x${r.json.height})`);

// bad upload: text file pretending to be jpeg
r = await api('POST', '/api/v1/uploads', { filename: 'fake.jpg', contentType: 'image/jpeg', byteLength: 12 });
await fetch(r.json.uploadUrl, { method: 'PUT', headers: r.json.headers, body: 'not an image' });
const bad = await api('POST', `/api/v1/uploads/${r.json.mediaId}/complete`);
assert(bad.json.status === 'rejected' && bad.json.errorCode === 'unsupported_type', 'fake image rejected by magic bytes');

// 3. draft
r = await api('POST', '/api/v1/drafts', { mediaId: ticket.mediaId });
assert(r.status === 201 && r.json.status === 'ready', 'draft created');
const draft = r.json;
r = await api('PATCH', `/api/v1/drafts/${draft.id}`, { feeling: 'lively', direction: 'A little breeze.', expectedVersion: draft.version });
assert(r.status === 200 && r.json.feeling === 'lively' && r.json.version === draft.version + 1, 'draft patched (version bumped)');
const version = r.json.version;
r = await api('PATCH', `/api/v1/drafts/${draft.id}`, { feeling: 'gentle', expectedVersion: 1 });
assert(r.status === 409, 'stale version rejected');

// 4. generation with idempotency
const key = randomUUID();
r = await api('POST', '/api/v1/generations', { draftId: draft.id, expectedDraftVersion: version }, { 'Idempotency-Key': key });
assert(r.status === 202 && r.json.status === 'queued' && r.json.creditState === 'held', 'generation accepted (credit held)');
const job = r.json;
const dup = await api('POST', '/api/v1/generations', { draftId: draft.id, expectedDraftVersion: version }, { 'Idempotency-Key': key });
assert(dup.status === 200 && dup.json.id === job.id, 'same key → same job');
const conflict = await api('POST', '/api/v1/generations', { draftId: draft.id, expectedDraftVersion: version + 5 }, { 'Idempotency-Key': key });
assert(conflict.status === 409, 'same key + different payload → 409');
r = await api('GET', '/api/v1/credits');
assert(r.json.available === startCredits - 1 && r.json.held === 1, 'balance reflects the hold');

// 5. wait for worker
const phases = new Set();
let filmId = job.filmId;
for (let i = 0; i < 180; i++) {
  await sleep(1000);
  r = await api('GET', `/api/v1/generations/${job.id}`);
  phases.add(r.json.status);
  if (r.json.status === 'ready' || r.json.status === 'failed' || r.json.status === 'abandoned') break;
}
assert(r.json.status === 'ready', `job finished: ${[...phases].join(' → ')}`);
assert(r.json.creditState === 'captured', 'credit captured exactly once');

// 6. film
r = await api('GET', `/api/v1/films/${filmId}`);
assert(r.status === 200 && r.json.status === 'ready' && r.json.playbackUrl && r.json.posterUrl, `film ready (${r.json.durationSeconds}s)`);
const play = await fetch(base + r.json.playbackUrl, { headers: { Range: 'bytes=0-99' } });
assert(play.status === 206, 'playback url supports range requests');
const dl = await fetch(base + `/api/v1/films/${filmId}/download`, { headers: { Cookie: cookie } });
assert(dl.status === 200 && dl.headers.get('content-disposition')?.includes('attachment'), 'download streams as attachment');
const anon = await fetch(base + `/api/v1/films/${filmId}`);
assert(anon.status === 401, 'anonymous film read rejected');
r = await api('PATCH', `/api/v1/films/${filmId}`, { title: 'Smoke test film' });
assert(r.status === 200 && r.json.title === 'Smoke test film', 'renamed');
r = await api('GET', '/api/v1/films?filter=ready');
assert(r.json.items.some((f) => f.id === filmId), 'gallery lists it');
r = await api('GET', '/api/v1/credits/history');
assert(r.json.items.some((e) => e.kind === 'capture'), 'credit history shows the completed film');

// 7. failure path: mock provider fails when direction contains [fail]
r = await api('POST', '/api/v1/drafts', { mediaId: ticket.mediaId });
const d2 = r.json;
r = await api('PATCH', `/api/v1/drafts/${d2.id}`, { direction: 'please [fail] this one', expectedVersion: d2.version });
r = await api('POST', '/api/v1/generations', { draftId: d2.id, expectedDraftVersion: r.json.version }, { 'Idempotency-Key': randomUUID() });
assert(r.status === 202, 'second generation accepted');
const job2 = r.json;
for (let i = 0; i < 180; i++) {
  await sleep(1000);
  r = await api('GET', `/api/v1/generations/${job2.id}`);
  if (['ready', 'failed', 'abandoned'].includes(r.json.status)) break;
}
assert(r.json.status === 'failed' && r.json.creditState === 'released', `failure released the credit (${r.json.failureCode})`);
r = await api('GET', '/api/v1/credits');
assert(r.json.available === startCredits - 1 && r.json.held === 0, 'balance: one consumed, one returned');

// 8. delete
r = await api('DELETE', `/api/v1/films/${filmId}`);
assert(r.status === 202, 'film deleted (tombstone)');
r = await api('GET', `/api/v1/films/${filmId}`);
assert(r.status === 404, 'deleted film is a neutral 404');

// 9. mock purchase
r = await api('POST', '/api/v1/billing/checkout', { productCode: 'pack_5' });
assert(r.status === 201 && r.json.provider === 'mock', 'mock checkout created');
const co = r.json;
r = await api('POST', `/api/v1/billing/checkout/${co.id}/mock-pay`, { outcome: 'success' });
assert(r.status === 200 && r.json.redirectUrl.includes('session_id='), 'mock payment succeeded');
const sid = new URL(base + r.json.redirectUrl).searchParams.get('session_id');
r = await api('GET', `/api/v1/billing/session-status?session_id=${encodeURIComponent(sid)}`);
assert(r.json.status === 'fulfilled' && r.json.creditsAdded === 5, 'session status fulfilled with 5 credits');
r = await api('GET', `/api/v1/billing/session-status?session_id=${encodeURIComponent(sid)}`);
assert(r.json.creditsAdded === 5, 'refresh does not double-grant');
r = await api('GET', '/api/v1/credits');
assert(r.json.available === startCredits - 1 + 5, `balance after purchase: ${r.json.available}`);

// 10. sign out
r = await api('POST', '/api/v1/auth/signout');
assert(r.status === 200, 'signed out');
r = await api('GET', '/api/v1/me');
assert(r.status === 401, 'session ended');
console.log('\nSMOKE JOURNEY PASSED');
