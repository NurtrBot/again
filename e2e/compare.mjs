#!/usr/bin/env node
/* Screenshot /review/NN at 390px × the reference panel height and write
 * side-by-side + 50% overlay images to e2e/__compare__/NN-*.png.
 * Usage: node e2e/compare.mjs [ids...]   (default: all 21)   BASE_URL env optional
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const bounds = JSON.parse(readFileSync(new URL('./panel-bounds.json', import.meta.url)));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(bounds);
const base = process.env.BASE_URL ?? 'http://localhost:3100';
mkdirSync(new URL('./__compare__/', import.meta.url), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
for (const id of ids) {
  const b = bounds[id];
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: b.cssH });
  await page.goto(`${base}/review/${id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const actual = new URL(`./__compare__/${id}-actual.png`, import.meta.url).pathname;
  await page.screenshot({ path: actual, fullPage: false });
  await page.close();
  const ref = new URL(`./reference/${id}.png`, import.meta.url).pathname;
  const out = new URL(`./__compare__/${id}-side.png`, import.meta.url).pathname;
  const overlay = new URL(`./__compare__/${id}-overlay.png`, import.meta.url).pathname;
  const py = `
from PIL import Image, ImageChops
a=Image.open(${JSON.stringify(actual)}).convert('RGB'); r=Image.open(${JSON.stringify(ref)}).convert('RGB')
h=max(a.height,r.height); s=Image.new('RGB',(a.width+r.width+12,h),(255,0,90)); s.paste(r,(0,0)); s.paste(a,(r.width+12,0)); s.save(${JSON.stringify(out)})
rr=r.resize(a.size) if r.size!=a.size else r
Image.blend(rr,a,0.5).save(${JSON.stringify(overlay)})
d=ImageChops.difference(rr,a).convert('L'); px=d.getdata(); n=sum(1 for p in px if p>40); print(f"${id} diff>40: {n/len(px)*100:.1f}%  ref {r.size} actual {a.size}")
`;
  writeFileSync('/tmp/_cmp.py', py);
  console.log(execFileSync('python3', ['/tmp/_cmp.py']).toString().trim());
}
await browser.close();
