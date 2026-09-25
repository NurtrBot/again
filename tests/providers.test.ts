import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAstraRequest, parseAstraResponse, compileMotionPrompt, mockPlan, validatePlan, type MotionPlan } from '../src/providers/astra';
import { buildVideoInput, parseStatus } from '../src/providers/video/higgsfield';
import { soraSizeFor } from '../src/providers/video/sora';
import { canonicalHash, safeReturnTo, withinDurationTolerance } from '../src/domain/helpers';
import { sniffImageType } from '../src/server/services/media';

const plan = JSON.parse(readFileSync('handoff/fixtures/motion-plan.json', 'utf8')) as MotionPlan;
const body = (output: unknown) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });

describe('astra adapter', () => {
  it('uses the configured model, strict schema, no retention, image + text', () => {
    process.env.OPENAI_MODEL = 'gpt-6-astra';
    const r = buildAstraRequest({ imageDataUrl: 'data:image/jpeg;base64,AAAA', feeling: 'gentle', direction: 'Soft movement', model: 'gpt-6-astra' });
    expect(r.model).toBe('gpt-6-astra');
    expect(r.store).toBe(false);
    expect(r.text.format.strict).toBe(true);
    expect(r.input[0].content[1]).toMatchObject({ type: 'input_image', detail: 'high' });
  });
  it('refusal / incomplete / style mismatch never become a paid prompt', () => {
    expect(() => parseAstraResponse({ status: 'incomplete', output: [] }, 'gentle')).toThrow(/INCOMPLETE/);
    expect(() => parseAstraResponse({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }, 'gentle')).toThrow(/REFUSAL/);
    expect(() => parseAstraResponse(body({ ...plan, motion_style: 'lively' }), 'gentle')).toThrow(/STYLE_MISMATCH/);
    expect(parseAstraResponse(body(plan), 'gentle').motion_style).toBe('gentle');
  });
  it('compiles a single-shot prompt that preserves occlusions and forbids additions', () => {
    const p = compileMotionPrompt(plan);
    expect(p).toMatch(/Keep occluded features occluded/);
    expect(p).toMatch(/No added people or objects/);
  });
  it('mock planner validates against the schema for every feeling', () => {
    for (const f of ['gentle', 'lively', 'surprise'] as const) expect(validatePlan(mockPlan(f, '', { width: 4, height: 3 }), f)._demo).toBe(true);
  });
});

describe('higgsfield adapter', () => {
  it('locks ten seconds, sound on, single shot, no resolution/aspect fields', () => {
    const p = buildVideoInput({ imageUrl: 'https://owned.example.test/x.jpg', prompt: 'animate' });
    expect(p).toMatchObject({ duration: 10, sound: 'on', cfg_scale: 0.5, multi_shots: false });
    expect('resolution' in p).toBe(false);
    expect(() => buildVideoInput({ imageUrl: 'http://insecure', prompt: 'x' })).toThrow();
  });
  it('validates completed status shape and id match', () => {
    expect(parseStatus({ request_id: 'a', status: 'completed', video: { url: 'https://cdn.example.test/o.mp4' } }, 'a')).toMatchObject({ state: 'completed' });
    expect(() => parseStatus({ request_id: 'b', status: 'failed' }, 'a')).toThrow(/MISMATCH/);
    expect(() => parseStatus({ request_id: 'a', status: 'completed' }, 'a')).toThrow(/MISSING_VIDEO/);
    expect(parseStatus({ request_id: 'a', status: 'nsfw' }, 'a')).toMatchObject({ state: 'failed', code: 'content_policy' });
    expect(parseStatus({ request_id: 'a', status: 'in_progress' }, 'a')).toMatchObject({ state: 'processing' });
  });
});

describe('sora adapter', () => {
  it('picks a supported canvas by orientation', () => {
    expect(soraSizeFor(1600, 1090, false).size).toBe('1280x720');
    expect(soraSizeFor(900, 1600, false).size).toBe('720x1280');
    expect(soraSizeFor(1600, 1090, true).size).toBe('1792x1024');
  });
});

describe('domain helpers', () => {
  it('canonical hash is key-order independent', () => {
    expect(canonicalHash({ a: 1, b: { c: 2 } })).toBe(canonicalHash({ b: { c: 2 }, a: 1 }));
  });
  it('returnTo rejects external and protocol-relative paths', () => {
    expect(safeReturnTo('https://evil.test')).toBe('/create');
    expect(safeReturnTo('//evil.test')).toBe('/create');
    expect(safeReturnTo('/\\evil.test')).toBe('/create');
    expect(safeReturnTo('/create/abc?resume=1')).toBe('/create/abc?resume=1');
  });
  it('duration tolerance accepts the reference clip and rejects a 5s clip', () => {
    expect(withinDurationTolerance(10.041667)).toBe(true);
    expect(withinDurationTolerance(5)).toBe(false);
  });
  it('sniffs real image bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBe('image/gif');
    expect(sniffImageType(Buffer.from('not an image at all'))).toBe('unknown');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(8)]);
    expect(sniffImageType(heic)).toBe('image/heic');
  });
});
