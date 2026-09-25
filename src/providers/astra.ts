/* Scene director: OpenAI Responses API with gpt-6-astra (live) or a deterministic local planner (mock).
 * Ported from handoff/reference-code/astra.mjs with server-owned image bytes (data URL). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEnv } from '@/src/server/env';
import type { Feeling } from '@/src/domain/helpers';

export interface MotionPlan {
  summary: string;
  scene_type: 'portrait' | 'group' | 'pet' | 'landscape' | 'product' | 'interior' | 'other';
  motion_style: Feeling;
  camera: string;
  subject_motion: string[];
  environment_motion: string[];
  preserve: string[];
  avoid: string[];
  audio: string;
  complexity: 'low' | 'medium' | 'high';
  caution: string | null;
  _demo?: boolean;
}

export class PlannerError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, retryable = false) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

const HANDOFF = resolve(process.cwd(), 'handoff');
export const MOTION_PLAN_SCHEMA = JSON.parse(readFileSync(resolve(HANDOFF, 'contracts/motion-plan.schema.json'), 'utf8')) as { required: string[]; properties: Record<string, { type?: string; enum?: string[] }> };
export const DIRECTOR_INSTRUCTIONS = readFileSync(resolve(HANDOFF, 'prompts/astra-director.txt'), 'utf8');
export const QUALITY_INSTRUCTIONS = readFileSync(resolve(HANDOFF, 'prompts/astra-quality-review.txt'), 'utf8');
export const QUALITY_SCHEMA = JSON.parse(readFileSync(resolve(HANDOFF, 'contracts/quality-review.schema.json'), 'utf8'));
export const PROMPT_VERSION = 'director-v1';

export function validatePlan(value: unknown, feeling: Feeling): MotionPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PlannerError('INVALID_PLAN');
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).filter((k) => k !== '_demo');
  if (keys.length !== MOTION_PLAN_SCHEMA.required.length || MOTION_PLAN_SCHEMA.required.some((k) => !(k in v))) throw new PlannerError('INVALID_PLAN_FIELDS');
  for (const [key, def] of Object.entries(MOTION_PLAN_SCHEMA.properties)) {
    const x = v[key];
    if (def.type === 'string' && (typeof x !== 'string' || x.length > 1500)) throw new PlannerError('INVALID_PLAN_' + key);
    if (def.enum && !def.enum.includes(x as string)) throw new PlannerError('INVALID_PLAN_' + key);
    if (def.type === 'array' && (!Array.isArray(x) || x.length > 12 || x.some((s) => typeof s !== 'string' || s.length > 500))) throw new PlannerError('INVALID_PLAN_' + key);
  }
  if (v.caution !== null && (typeof v.caution !== 'string' || v.caution.length > 1000)) throw new PlannerError('INVALID_CAUTION');
  if (v.motion_style !== feeling) throw new PlannerError('STYLE_MISMATCH');
  if ((v.subject_motion as string[]).length > 3 || (v.environment_motion as string[]).length > 2) throw new PlannerError('EXCESSIVE_MOTION');
  return v as unknown as MotionPlan;
}

export function buildAstraRequest(input: { imageDataUrl: string; feeling: Feeling; direction: string; model: string }) {
  if (input.direction.length > 500) throw new PlannerError('INVALID_DIRECTION');
  return {
    model: input.model,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: 6000,
    instructions: DIRECTOR_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: JSON.stringify({ selected_feeling: input.feeling, creative_direction: input.direction, duration_seconds: 10 }) },
          { type: 'input_image', image_url: input.imageDataUrl, detail: 'high' },
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'again_motion_plan', strict: true, schema: MOTION_PLAN_SCHEMA } },
  };
}

interface ResponsesBody {
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{ type: string; content?: Array<{ type: string; text?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function parseAstraResponse(body: ResponsesBody, feeling: Feeling): MotionPlan {
  if (body.status !== 'completed') throw new PlannerError('ASTRA_INCOMPLETE', body.status === 'in_progress' || body.status === 'queued');
  const content = (body.output ?? []).filter((x) => x.type === 'message').flatMap((x) => x.content ?? []);
  if (content.some((x) => x.type === 'refusal')) throw new PlannerError('ASTRA_REFUSAL');
  const text = content
    .filter((x) => x.type === 'output_text')
    .map((x) => x.text ?? '')
    .join('');
  if (!text) throw new PlannerError('ASTRA_NO_OUTPUT');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlannerError('ASTRA_BAD_JSON');
  }
  return validatePlan(parsed, feeling);
}

export async function callAstraDirector(input: { imageBytes: Buffer; mime: string; feeling: Feeling; direction: string }, fetchImpl: typeof fetch = fetch): Promise<{ plan: MotionPlan; usage: ResponsesBody['usage'] }> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) throw new PlannerError('OPENAI_KEY_MISSING');
  const dataUrl = `data:${input.mime};base64,${input.imageBytes.toString('base64')}`;
  const req = buildAstraRequest({ imageDataUrl: dataUrl, feeling: input.feeling, direction: input.direction, model: env.OPENAI_MODEL });
  const res = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(180_000),
  });
  if (res.status === 401 || res.status === 403) throw new PlannerError('ASTRA_AUTH');
  if (res.status === 404) throw new PlannerError('ASTRA_MODEL_UNAVAILABLE');
  if (res.status === 429 || res.status >= 500) throw new PlannerError(`ASTRA_HTTP_${res.status}`, true);
  if (!res.ok) throw new PlannerError(`ASTRA_HTTP_${res.status}`);
  const body = (await res.json()) as ResponsesBody;
  return { plan: parseAstraResponse(body, input.feeling), usage: body.usage };
}

/** Deterministic local planner for demo mode: style-specific, scene-agnostic, honest. */
export function mockPlan(feeling: Feeling, direction: string, dims: { width: number; height: number }): MotionPlan {
  const landscape = dims.width >= dims.height;
  const base: Record<Feeling, MotionPlan> = {
    gentle: {
      summary: 'A quiet breath of movement across the scene.',
      scene_type: 'other',
      motion_style: 'gentle',
      camera: landscape ? 'Nearly locked with a barely perceptible forward drift.' : 'Locked camera with a slight settle.',
      subject_motion: ['Visible subjects breathe and blink naturally without changing pose.'],
      environment_motion: ['Soft light and any fabric or foliage sway very slightly.'],
      preserve: ['All faces, clothing and objects exactly as photographed', 'Composition and framing', 'Any visible text or watermark'],
      avoid: ['New people or objects', 'Large gestures', 'Scene cuts'],
      audio: 'Quiet natural room or outdoor tone, no dialogue or music',
      complexity: 'low',
      caution: null,
    },
    lively: {
      summary: 'A brighter smile and a playful turn of the moment.',
      scene_type: 'other',
      motion_style: 'lively',
      camera: 'A gentle, slightly more confident push-in.',
      subject_motion: ['The main subject shifts weight and brightens expression.', 'A small natural head turn toward the camera.'],
      environment_motion: ['Background elements move with a little more energy.', 'Light flickers naturally.'],
      preserve: ['Identities, hands and clothing', 'Setting and geometry', 'Visible lettering'],
      avoid: ['Dramatic camera orbit', 'Everyone moving at once', 'Pose changes'],
      audio: 'Lively but quiet ambience, no dialogue or music',
      complexity: 'medium',
      caution: null,
    },
    surprise: {
      summary: 'A tasteful, unexpected touch from what is already in frame.',
      scene_type: 'other',
      motion_style: 'surprise',
      camera: 'A slow reveal drift that keeps the whole scene visible.',
      subject_motion: ['One visible subject reacts with a small, charming gesture.'],
      environment_motion: ['An existing element (light, water, fabric) becomes the star briefly.', 'Ambient particles drift.'],
      preserve: ['Every identity and object', 'The setting', 'Rigid text and logos'],
      avoid: ['Adding anything not in the photo', 'Changing the setting', 'Making anyone speak'],
      audio: 'Quiet scene-appropriate ambience, no dialogue or music',
      complexity: 'medium',
      caution: null,
    },
  };
  const plan = base[feeling];
  if (direction.trim()) plan.caution = 'Demo planner: your direction was recorded but the demo render only performs a slow push-in.';
  return { ...plan, _demo: true };
}

export function compileMotionPrompt(plan: MotionPlan): string {
  validatePlan({ ...plan, _demo: undefined }, plan.motion_style);
  return [
    'A realistic living photograph. One continuous 10-second shot beginning exactly with the supplied source image.',
    'Preserve the original subjects, visible identities, anatomy, clothing, composition, lighting, architecture, products, lettering, logos and watermark. Keep occluded features occluded.',
    `Camera: ${plan.camera}`,
    `Visible subject movement: ${plan.subject_motion.join(' ')}`,
    `Environmental movement: ${plan.environment_motion.join(' ')}`,
    `Preserve in particular: ${plan.preserve.join('; ')}.`,
    `Avoid: ${plan.avoid.join('; ')}.`,
    `Sound: ${plan.audio}. No intelligible dialogue and no music.`,
    'Small believable motions. No added people or objects, no cuts, no scene changes, no dramatic orbit or large pose changes.',
  ].join('\n');
}

/** Optional sampled-frame quality review (QUALITY_REVIEW_ENABLED). Returns verdict; never proves every frame. */
export async function callQualityReview(input: { original: Buffer; frames: Buffer[] }): Promise<{ verdict: 'accept' | 'reject' | 'uncertain'; issues: string[]; suggested_revision: string | null }> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) throw new PlannerError('OPENAI_KEY_MISSING');
  const content: unknown[] = [{ type: 'input_text', text: 'Original still:' }, { type: 'input_image', image_url: `data:image/jpeg;base64,${input.original.toString('base64')}`, detail: 'high' }];
  input.frames.forEach((f, i) => {
    content.push({ type: 'input_text', text: `Frame ${i + 1} of ${input.frames.length}:` });
    content.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${f.toString('base64')}`, detail: 'low' });
  });
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OPENAI_MODEL, store: false, instructions: QUALITY_INSTRUCTIONS, input: [{ role: 'user', content }], text: { format: { type: 'json_schema', name: 'again_quality_review', strict: true, schema: QUALITY_SCHEMA } } }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new PlannerError(`ASTRA_HTTP_${res.status}`, res.status >= 500);
  const body = (await res.json()) as ResponsesBody;
  const text = (body.output ?? []).filter((x) => x.type === 'message').flatMap((x) => x.content ?? []).filter((x) => x.type === 'output_text').map((x) => x.text ?? '').join('');
  const parsed = JSON.parse(text);
  if (!['accept', 'reject', 'uncertain'].includes(parsed.verdict)) throw new PlannerError('INVALID_REVIEW');
  return parsed;
}
