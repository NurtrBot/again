-- again. core schema. Portable Postgres; Supabase-only RLS/grants live in 0002.
-- Source: handoff/contracts/schema.sql (extended with columns the app needs).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '' check (length(display_name) <= 80),
  onboarding_complete boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_accounts (
  user_id uuid primary key references public.profiles(id),
  spending_blocked boolean not null default false,
  review_reason text,
  version bigint not null default 0
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('source','normalized','poster','video')),
  storage_bucket text not null,
  object_key text not null,
  state text not null check (state in ('pending','validating','ready','rejected','deleting','deleted')),
  mime_type text,
  byte_length bigint check (byte_length >= 0),
  width integer,
  height integer,
  duration_seconds numeric,
  sha256 text,
  error_code text,
  original_filename text,
  parent_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, object_key),
  unique (id, user_id)
);
create index if not exists media_assets_owner on public.media_assets(user_id, created_at desc);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  source_asset_id uuid not null,
  normalized_asset_id uuid,
  feeling text not null default 'gentle' check (feeling in ('gentle','lively','surprise')),
  direction text not null default '' check (length(direction) <= 500),
  version integer not null default 1 check (version > 0),
  status text not null default 'ready' check (status in ('validating','ready','generating','completed','invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (source_asset_id, user_id) references public.media_assets(id, user_id),
  foreign key (normalized_asset_id, user_id) references public.media_assets(id, user_id)
);
create index if not exists drafts_owner on public.drafts(user_id, updated_at desc);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  draft_id uuid not null,
  draft_version integer not null,
  input_snapshot jsonb not null,
  idempotency_key text not null,
  payload_hash text not null,
  status text not null check (status in ('queued','planning','submitting','submission_unknown','processing','validating_output','ready','failed','abandoned')),
  credit_state text not null default 'held' check (credit_state in ('held','captured','released')),
  planner_model text not null default 'gpt-6-astra',
  prompt_version text not null default 'director-v1',
  motion_plan jsonb,
  compiled_prompt text,
  failure_code text,
  phase_detail text,
  max_provider_cost_usd numeric(10,4) not null default 5 check (max_provider_cost_usd >= 0),
  provider_cost_usd numeric(10,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key),
  unique (id, user_id),
  foreign key (draft_id, user_id) references public.drafts(id, user_id),
  check (status <> 'ready' or credit_state = 'captured'),
  check (status not in ('failed','abandoned') or credit_state = 'released')
);
create index if not exists generations_owner_active on public.generations(user_id) where status not in ('ready','failed','abandoned');

create table if not exists public.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id),
  ordinal integer not null check (ordinal > 0),
  provider text not null default 'higgsfield',
  model text not null,
  state text not null check (state in ('prepared','sending','unknown','queued','processing','completed','failed','rejected','abandoned')),
  provider_request_id text,
  result_url_encrypted text,
  provider_status text,
  cost_usd numeric(10,4),
  last_polled_at timestamptz,
  poll_count integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generation_id, ordinal),
  unique (provider, provider_request_id)
);

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  generation_id uuid not null unique,
  draft_id uuid not null,
  title text not null check (length(title) between 1 and 80),
  state text not null default 'creating' check (state in ('creating','ready','failed')),
  output_asset_id uuid,
  poster_asset_id uuid,
  source_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (generation_id, user_id) references public.generations(id, user_id),
  foreign key (draft_id, user_id) references public.drafts(id, user_id),
  foreign key (output_asset_id, user_id) references public.media_assets(id, user_id),
  foreign key (poster_asset_id, user_id) references public.media_assets(id, user_id),
  foreign key (source_asset_id, user_id) references public.media_assets(id, user_id),
  check (state <> 'ready' or output_asset_id is not null)
);
create index if not exists films_owner_gallery on public.films(user_id, created_at desc, id desc) where deleted_at is null;

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('purchase','monthly','recovery','adjustment')),
  source_key text not null unique,
  description text not null default '',
  issued integer not null check (issued > 0),
  available integer not null check (available >= 0),
  held integer not null default 0 check (held >= 0),
  consumed integer not null default 0 check (consumed >= 0),
  expired integer not null default 0 check (expired >= 0),
  revoked integer not null default 0 check (revoked >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (issued = available + held + consumed + expired + revoked),
  check (kind <> 'purchase' or expires_at is null)
);
create index if not exists credit_grants_spend_order on public.credit_grants(user_id, expires_at, created_at) where available > 0;

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  generation_id uuid not null unique,
  grant_id uuid not null,
  status text not null check (status in ('held','captured','released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  foreign key (generation_id, user_id) references public.generations(id, user_id),
  foreign key (grant_id, user_id) references public.credit_grants(id, user_id),
  check ((status = 'held' and settled_at is null) or (status <> 'held' and settled_at is not null))
);

create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  grant_id uuid,
  generation_id uuid,
  kind text not null check (kind in ('grant','hold','capture','release','expire','revoke','recovery','adjustment')),
  amount integer not null,
  event_key text not null unique,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (grant_id, user_id) references public.credit_grants(id, user_id),
  foreign key (generation_id, user_id) references public.generations(id, user_id)
);
create index if not exists credit_events_owner on public.credit_events(user_id, created_at desc, id desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  draft_id uuid,
  product_code text not null,
  catalog_version text not null,
  idempotency_key text not null,
  payload_hash text not null,
  stripe_customer_id text not null,
  stripe_session_id text unique,
  client_secret text,
  mode text not null check (mode in ('payment','subscription')),
  expected_subtotal_cents integer not null check (expected_subtotal_cents >= 0),
  final_total_cents integer,
  tax_cents integer,
  currency text not null default 'usd',
  status text not null check (status in ('creating','open','pending','fulfilled','failed','refunded','canceled')),
  credits_granted integer,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (draft_id, user_id) references public.drafts(id, user_id)
);
create index if not exists orders_owner on public.orders(user_id, created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  plan_code text not null check (plan_code in ('monthly_10','creator_25')),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  scheduled_plan_code text,
  schedule_id text,
  last_invoice_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_live_subscription on public.subscriptions(user_id) where status in ('active','trialing','past_due','incomplete','unpaid','paused');

create table if not exists public.webhook_events (
  id text primary key,
  provider text not null default 'stripe',
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  attempts integer not null default 0
);

create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 50,
  lease_owner text,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);
create index if not exists outbox_pending on public.outbox(available_at) where completed_at is null;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subject text not null check (length(subject) between 1 and 120),
  message text not null check (length(message) between 1 and 3000),
  generation_id uuid,
  created_at timestamptz not null default now(),
  foreign key (generation_id, user_id) references public.generations(id, user_id)
);

create table if not exists public.idempotency_keys (
  user_id uuid not null references public.profiles(id),
  scope text not null,
  key text not null,
  payload_hash text not null,
  response_status integer not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, scope, key)
);

create table if not exists public.worker_heartbeats (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  version text
);

create table if not exists public.provider_spend (
  day date not null,
  provider text not null,
  amount_usd numeric(12,4) not null default 0,
  jobs integer not null default 0,
  primary key (day, provider)
);
