/* Live planner check (spends a small amount on OPENAI_API_KEY):
 *   npx tsx scripts/test-astra.ts [image] [feeling] ["direction"]
 * Prints the validated motion plan and the compiled Kling prompt. */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { callAstraDirector, compileMotionPrompt } from '../src/providers/astra';
import type { Feeling } from '../src/domain/helpers';

const [image = 'handoff/fixtures/restaurant-source.jpeg', feeling = 'gentle', direction = ''] = process.argv.slice(2);
(async () => {
  const bytes = await sharp(readFileSync(image)).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const t0 = Date.now();
  const { plan, usage } = await callAstraDirector({ imageBytes: bytes, mime: 'image/jpeg', feeling: feeling as Feeling, direction });
  console.log(`model=${process.env.OPENAI_MODEL} latency=${((Date.now() - t0) / 1000).toFixed(1)}s tokens=${JSON.stringify(usage)}`);
  console.log(JSON.stringify(plan, null, 2));
  console.log('\n--- compiled prompt ---\n' + compileMotionPrompt(plan));
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
