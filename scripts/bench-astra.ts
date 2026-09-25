/* Times one planner call: npx tsx scripts/bench-astra.ts <effort> <detail> <maxEdge> */
import { loadEnv } from '../src/server/load-env';
loadEnv();
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const [effort = 'medium', detail = 'high', edge = '2560'] = process.argv.slice(2);
process.env.ASTRA_REASONING_EFFORT = effort;
process.env.ASTRA_IMAGE_DETAIL = detail;
(async () => {
  const { callAstraDirector } = await import('../src/providers/astra');
  const bytes = await sharp(readFileSync('handoff/fixtures/restaurant-source.jpeg')).resize({ width: Number(edge), height: Number(edge), fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
  const t0 = Date.now();
  const { plan, usage } = await callAstraDirector({ imageBytes: bytes, mime: 'image/jpeg', feeling: 'gentle', direction: '' });
  console.log(`effort=${effort} detail=${detail} edge=${edge}: ${((Date.now() - t0) / 1000).toFixed(1)}s in=${usage?.input_tokens} out=${usage?.output_tokens} | ${plan.summary} | motions ${plan.subject_motion.length}+${plan.environment_motion.length} | caution: ${plan.caution?.slice(0, 70) ?? 'none'}`);
})();
