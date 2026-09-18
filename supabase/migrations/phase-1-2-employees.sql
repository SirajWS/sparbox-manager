-- MixMax Manager – Phase 1.2
-- Nur im bestehenden Supabase-Projekt ausführen.
-- Ergänzt die gemeinsame Mitarbeiterliste.
-- bookings-Daten werden nicht gelöscht, nicht zurückgesetzt und nicht verändert.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0 and char_length(name) <= 60),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create unique index if not exists employees_name_normalized_idx
  on public.employees (lower(btrim(name)));

create or replace function public.employees_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.created_by := auth.uid();
  new.name := btrim(new.name);
  return new;
end;
$$;

drop trigger if exists employees_before_insert on public.employees;
create trigger employees_before_insert
before insert on public.employees
for each row execute procedure public.employees_before_insert();

alter table public.employees enable row level security;

revoke all on table public.employees from anon, public;
grant select, insert, delete on table public.employees to authenticated;

drop policy if exists "employees_select_authenticated" on public.employees;
drop policy if exists "employees_insert_authenticated" on public.employees;
drop policy if exists "employees_delete_authenticated" on public.employees;

create policy "employees_select_authenticated"
  on public.employees
  for select
  to authenticated
  using (true);

create policy "employees_insert_authenticated"
  on public.employees
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "employees_delete_authenticated"
  on public.employees
  for delete
  to authenticated
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employees'
  ) then
    execute 'alter publication supabase_realtime add table public.employees';
  end if;
end $$;
