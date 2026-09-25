-- Motion-plan cache keyed by normalized image hash + feeling + direction + prompt/model version.
-- Lets planning start on the Direction screen (PREPLAN_ON_DIRECTION) so Animate is faster.
create table if not exists public.plan_cache (
  cache_key text primary key,
  user_id uuid not null references public.profiles(id),
  plan jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists plan_cache_owner on public.plan_cache(user_id, created_at desc);
do $$ begin
  execute 'alter table public.plan_cache enable row level security';
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on table public.plan_cache from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on table public.plan_cache from authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant all on table public.plan_cache to service_role'; end if;
end $$;
