/* Live Sora render check (spends money on OPENAI_API_KEY; one 12s clip, trimmed to 10s):
 *   npx tsx scripts/test-sora.ts [image] [feeling] [outDir]
 * Runs Astra planning, submits ONE Sora job, polls, downloads, trims to 10.000s, probes. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { callAstraDirector, compileMotionPrompt } from '../src/providers/astra';
import { SoraProvider } from '../src/providers/video/sora';
import { probe, trimTo, tempDir, extractPoster } from '../src/providers/ffmpeg';
import type { Feeling } from '../src/domain/helpers';

const [image = 'handoff/fixtures/restaurant-source.jpeg', feeling = 'gentle', outDir = '.data/live-tests'] = process.argv.slice(2);
(async () => {
  mkdirSync(outDir, { recursive: true });
  const meta = await sharp(readFileSync(image)).metadata();
  const bytes = await sharp(readFileSync(image)).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const { plan } = await callAstraDirector({ imageBytes: bytes, mime: 'image/jpeg', feeling: feeling as Feeling, direction: '' });
  const prompt = compileMotionPrompt(plan);
  console.log('plan:', plan.summary);
  const sora = new SoraProvider();
  const t0 = Date.now();
  const sub = await sora.submit({ generationId: 'test', attemptId: 'test', prompt, imageBytes: bytes, imageMime: 'image/jpeg', width: meta.width!, height: meta.height!, imageUrl: null });
  console.log(`submitted ${sub.requestId} (${sub.status}) model=${sora.model}`);
  let state = 'queued';
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const p = await sora.poll(sub.requestId);
    if (p.state !== 'processing' || p.phase !== state) console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s: ${p.state}${p.state === 'processing' ? ' ' + p.phase : ''}`);
    if (p.state === 'failed') {
      console.error('FAILED:', p.code);
      process.exit(1);
    }
    if (p.state === 'completed') break;
    state = p.phase;
  }
  const t = await tempDir('again-sora-');
  const raw = join(t.dir, 'raw.mp4');
  await sora.download(sub.requestId, null, raw);
  const before = await probe(raw);
  const final = join(outDir, `sora-${feeling}-${Date.now()}.mp4`);
  await trimTo(raw, final, 10);
  const after = await probe(final);
  await extractPoster(final, final.replace('.mp4', '.jpg'));
  copyFileSync(raw, final.replace('.mp4', '-raw12s.mp4'));
  console.log(`raw: ${before.width}x${before.height} ${before.durationSeconds.toFixed(3)}s audio=${before.hasAudio}`);
  console.log(`final: ${after.width}x${after.height} ${after.durationSeconds.toFixed(3)}s audio=${after.hasAudio} -> ${final}`);
  console.log(`total wall time ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await t.cleanup();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
