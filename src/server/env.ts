import { z } from 'zod';

const bool = (d: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));
const int = (d: number) => z.string().optional().transform((v) => (v === undefined || v === '' ? d : Number.parseInt(v, 10)));
const num = (d: number) => z.string().optional().transform((v) => (v === undefined || v === '' ? d : Number.parseFloat(v)));
const str = (d = '') => z.string().optional().transform((v) => (v === undefined ? d : v));

const schema = z.object({
  NODE_ENV: str('development'),
  APP_MODE: z.enum(['mock', 'live']).default('mock'),
  APP_URL: str('http://localhost:3000'),
  APP_SECRET: z.string().min(16, 'APP_SECRET must be at least 16 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_TEST_URL: str(''),

  AUTH_DRIVER: z.enum(['local', 'supabase']).default('local'),
  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  SMTP_URL: str(''),
  MAIL_FROM: str('again. <no-reply@localhost>'),
  NEXT_PUBLIC_SUPABASE_URL: str(''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str(''),
  SUPABASE_SERVICE_ROLE_KEY: str(''),
  OAUTH_PROVIDERS: str(''),

  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  LOCAL_MEDIA_DIR: str('.data/media'),
  PUBLIC_MEDIA_BASE_URL: str(''),

  GENERATION_ENABLED: bool(true),
  PLANNER_PROVIDER: z.enum(['mock', 'astra']).default('mock'),
  OPENAI_API_KEY: str(''),
  OPENAI_MODEL: str('gpt-6-astra'),
  VIDEO_PROVIDER: z.enum(['mock', 'higgsfield', 'sora']).default('mock'),
  HF_CREDENTIALS: str(''),
  HF_MODEL: str('kling-video/v3.0/pro/image-to-video'),
  SORA_MODEL: str('sora-2'),
  ASTRA_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  ASTRA_IMAGE_DETAIL: z.enum(['low', 'high', 'auto']).default('high'),
  PREPLAN_ON_DIRECTION: bool(false),
  QUALITY_REVIEW_ENABLED: bool(false),
  QUALITY_RETRY_LIMIT: int(0),
  MAX_ACTIVE_JOBS_PER_USER: int(2),
  GLOBAL_GENERATION_CONCURRENCY: int(4),
  DAILY_PROVIDER_BUDGET_USD: num(25),
  MAX_JOB_PROVIDER_COST_USD: num(5),
  PROVIDER_INPUT_URL_TTL_SECONDS: int(7200),
  PROVIDER_MEDIA_ALLOWED_HOSTS: str(''),
  MOCK_GENERATION_SECONDS: int(20),
  UNKNOWN_SUBMISSION_SLA_HOURS: int(24),

  PAYMENTS_ENABLED: bool(true),
  PAYMENTS_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: str(''),
  STRIPE_SECRET_KEY: str(''),
  STRIPE_WEBHOOK_SECRET: str(''),
  STRIPE_PRICE_PACK_1: str(''),
  STRIPE_PRICE_PACK_5: str(''),
  STRIPE_PRICE_PACK_10: str(''),
  STRIPE_PRICE_MONTHLY_10: str(''),
  STRIPE_PRICE_CREATOR_25: str(''),
  STRIPE_API_VERSION: str(''),

  DEV_SEED_CREDITS: int(0),
  REVIEW_ROUTES_ENABLED: bool(false),
  SUPPORT_EMAIL: str('support@localhost'),
  HEIC_SUPPORTED: z.string().optional(),
});

export type Env = z.infer<typeof schema> & {
  isProduction: boolean;
  demo: { any: boolean; auth: boolean; payments: boolean; planner: boolean; video: boolean; storage: boolean };
  oauthProviders: Array<'google' | 'apple'>;
  reviewRoutesEnabled: boolean;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${msg}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  // APP_MODE=mock forces every adapter to its demo implementation.
  if (e.APP_MODE === 'mock') {
    e.PAYMENTS_PROVIDER = 'mock';
    e.VIDEO_PROVIDER = e.VIDEO_PROVIDER === 'mock' ? 'mock' : e.VIDEO_PROVIDER; // explicit live renderers may be tested in mock mode
  }
  if (isProduction && e.APP_MODE === 'mock' && !process.env.ALLOW_MOCK_IN_PRODUCTION) {
    throw new Error('APP_MODE=mock is rejected in production. Set ALLOW_MOCK_IN_PRODUCTION=1 only for an owner-private staging demo.');
  }
  const demo = {
    auth: e.AUTH_DRIVER === 'local',
    payments: e.PAYMENTS_PROVIDER === 'mock',
    planner: e.PLANNER_PROVIDER === 'mock',
    video: e.VIDEO_PROVIDER === 'mock',
    storage: e.STORAGE_DRIVER === 'local',
    any: false,
  };
  demo.any = demo.payments || demo.planner || demo.video || demo.auth;
  const oauthProviders = e.OAUTH_PROVIDERS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is 'google' | 'apple' => s === 'google' || s === 'apple')
    .filter(() => e.AUTH_DRIVER === 'supabase');
  cached = {
    ...e,
    isProduction,
    demo,
    oauthProviders,
    reviewRoutesEnabled: e.REVIEW_ROUTES_ENABLED && !isProduction ? true : e.REVIEW_ROUTES_ENABLED && !!process.env.ALLOW_REVIEW_IN_PRODUCTION,
  };
  return cached;
}

/** Values safe to send to the browser. */
export function publicConfig() {
  const e = getEnv();
  return {
    appMode: e.APP_MODE,
    demo: e.demo,
    oauthProviders: e.oauthProviders,
    paymentsProvider: e.PAYMENTS_PROVIDER,
    stripePublishableKey: e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    supportEmail: e.SUPPORT_EMAIL,
    heicSupported: process.env.HEIC_SUPPORTED !== 'false',
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;
