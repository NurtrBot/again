-- Row level security and narrow grants. Safe on plain Postgres: role-specific
-- statements only run when the Supabase roles exist.
do $$
declare t text;
begin
  foreach t in array array['profiles','credit_accounts','media_assets','drafts','generations','provider_attempts','films','credit_grants','credit_reservations','credit_events','orders','subscriptions','webhook_events','outbox','support_tickets','idempotency_keys','worker_heartbeats','provider_spend'] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table public.%I from authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.profiles, public.films, public.drafts to authenticated;
  end if;
end $$;

drop policy if exists profile_self_read on public.profiles;
create policy profile_self_read on public.profiles for select using (auth_uid_or_null() = id);
drop policy if exists draft_self_read on public.drafts;
create policy draft_self_read on public.drafts for select using (auth_uid_or_null() = user_id);
drop policy if exists film_self_read on public.films;
create policy film_self_read on public.films for select using (auth_uid_or_null() = user_id and deleted_at is null);
