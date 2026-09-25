/* Live Higgsfield (Kling 3.0 pro I2V) check — spends provider balance for ONE 10s render.
 *   npx tsx scripts/test-higgsfield.ts [image] [feeling] [outDir]
 * Astra plans, the image is served from local storage through PUBLIC_MEDIA_BASE_URL, one POST,
 * authenticated polling, then the output URL is printed (host needed for PROVIDER_MEDIA_ALLOWED_HOSTS)
 * and downloaded with the same safe-fetch policy the worker uses. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { callAstraDirector, compileMotionPrompt } from '../src/providers/astra';
import { HiggsfieldProvider } from '../src/providers/video/higgsfield';
import { storage } from '../src/server/storage';
import { getEnv } from '../src/server/env';
import { probe, extractPoster, tempDir, remuxFaststart } from '../src/providers/ffmpeg';
import { safeDownload } from '../src/providers/safe-fetch';
import type { Feeling } from '../src/domain/helpers';

const [image = 'handoff/fixtures/restaurant-source.jpeg', feeling = 'gentle', outDir = '.data/live-tests'] = process.argv.slice(2);
(async () => {
  const env = getEnv();
  if (!env.PUBLIC_MEDIA_BASE_URL.startsWith('https://')) throw new Error('PUBLIC_MEDIA_BASE_URL must be an https tunnel to this app');
  mkdirSync(outDir, { recursive: true });
  const bytes = await sharp(readFileSync(image)).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(bytes).metadata();
  const key = `live-test/${randomUUID()}.jpg`;
  await storage().write('normalized', key, bytes, 'image/jpeg');
  const imageUrl = (await storage().providerReadUrl('normalized', key, env.PROVIDER_INPUT_URL_TTL_SECONDS))!;
  const head = await fetch(imageUrl, { method: 'GET', headers: { Range: 'bytes=0-10' } });
  console.log(`image url reachable through tunnel: ${head.status}`);
  if (head.status !== 206 && head.status !== 200) throw new Error('tunnel not serving the image');

  const t0 = Date.now();
  const { plan } = await callAstraDirector({ imageBytes: bytes, mime: 'image/jpeg', feeling: feeling as Feeling, direction: '' });
  console.log(`astra plan (${((Date.now() - t0) / 1000).toFixed(1)}s): ${plan.summary}`);
  const prompt = compileMotionPrompt(plan);

  const hf = new HiggsfieldProvider();
  const sub = await hf.submit({ generationId: 'test', attemptId: 'test', prompt, imageBytes: bytes, imageMime: 'image/jpeg', width: meta.width!, height: meta.height!, imageUrl });
  console.log(`submitted ${sub.requestId} status=${sub.status} model=${hf.model}`);
  let last = '';
  let outputUrl: string | null = null;
  for (let i = 0; i < 360; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const p = await hf.poll(sub.requestId);
    const label = p.state === 'processing' ? p.phase : p.state;
    if (label !== last) console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s: ${label}`);
    last = label;
    if (p.state === 'failed') throw new Error(`provider failed: ${p.code}`);
    if (p.state === 'completed') {
      outputUrl = p.outputUrl;
      break;
    }
  }
  if (!outputUrl) throw new Error('timed out');
  const host = new URL(outputUrl).hostname;
  console.log(`output url host: ${host}  (add to PROVIDER_MEDIA_ALLOWED_HOSTS)`);
  const t = await tempDir('again-hf-');
  const raw = join(t.dir, 'raw.mp4');
  await safeDownload(outputUrl, raw, { allowedHosts: [host], maxBytes: 512 * 1024 * 1024, timeoutMs: 300_000 });
  const final = join(outDir, `higgsfield-${feeling}-${Date.now()}.mp4`);
  await remuxFaststart(raw, final);
  const m = await probe(final);
  await extractPoster(final, final.replace('.mp4', '.jpg'));
  console.log(`final: ${m.width}x${m.height} ${m.durationSeconds.toFixed(3)}s audio=${m.hasAudio} ${(m.byteLength / 1e6).toFixed(1)}MB -> ${final}`);
  console.log(`total wall time ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await t.cleanup();
  await storage().delete('normalized', key);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
