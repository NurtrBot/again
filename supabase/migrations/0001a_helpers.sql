-- auth.uid() exists on Supabase only. This wrapper lets policies compile on
-- plain Postgres (returns null there, which denies every client read).
create or replace function public.auth_uid_or_null() returns uuid
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth' and p.proname = 'uid') then
    return (select auth.uid());
  end if;
  return null;
exception when others then
  return null;
end $$;
revoke all on function public.auth_uid_or_null() from public;
