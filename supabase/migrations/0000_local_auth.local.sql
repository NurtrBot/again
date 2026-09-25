-- Applied ONLY when AUTH_DRIVER=local (self-hosted Postgres). On Supabase the
-- auth schema already exists and this file is skipped by the migration runner.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create table if not exists public.auth_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  resend_count integer not null default 0,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists auth_otp_challenges_email on public.auth_otp_challenges(email, created_at desc);
create table if not exists public.auth_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists auth_sessions_user on public.auth_sessions(user_id);
-- Demo inbox: outgoing mail kept locally when MAIL_DRIVER=console.
create table if not exists public.dev_outbox_mail (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
