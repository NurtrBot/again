/* Round-trips one object through the Vercel Blob driver: presigned PUT (as the browser would),
 * head, read, presigned GET (as a provider would), delete.  Needs BLOB_READ_WRITE_TOKEN. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { readFileSync } from 'node:fs';
process.env.STORAGE_DRIVER = 'blob';
(async () => {
  const { BlobStorage } = await import('../src/server/storage/blob');
  const s = new BlobStorage();
  const bytes = readFileSync('public/samples/restaurant.jpg');
  const key = `blob-test/${Date.now()}.jpg`;
  const up = await s.createSignedUpload('sources', key, { contentType: 'image/jpeg', byteLength: bytes.length, ttlSeconds: 600 });
  const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: bytes });
  console.log('presigned PUT:', put.status, (await put.text()).slice(0, 120));
  const h = await s.head('sources', key);
  console.log('head:', h);
  const back = await s.read('sources', key);
  console.log('read bytes equal:', back.length === bytes.length);
  const url = await s.signedReadUrl('sources', key, { ttlSeconds: 300 });
  const g = await fetch(url);
  console.log('presigned GET:', g.status, g.headers.get('content-type'), 'host', new URL(url).host);
  const anon = await fetch(url.split('?')[0]);
  console.log('unsigned GET (should be denied):', anon.status);
  await s.delete('sources', key);
  console.log('deleted; head now:', await s.head('sources', key));
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
