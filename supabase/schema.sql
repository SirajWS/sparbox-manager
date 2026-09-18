-- MixMax Manager – Phase 1 / 1.1
-- In der Supabase SQL-Konsole ausführen.
-- Neue Projekte: gesamten Inhalt ausführen.
-- Bestehende Phase-1-Tabellen: denselben Inhalt ausführen.
-- CREATE TABLE IF NOT EXISTS ändert vorhandene Tabellen nicht;
-- die ALTER-Blöcke ergänzen optionale Spalten idempotent.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in', 'out')),
  amount numeric(12, 3) not null check (amount > 0),
  currency text not null default 'TND' check (currency = 'TND'),
  category text not null check (char_length(btrim(category)) > 0),
  item text,
  note text,
  date date not null,
  paid_by text not null check (paid_by in ('siraj', 'chedi', 'other')),
  booking_kind text not null default 'normal' check (booking_kind in ('normal', 'employee_advance')),
  employee_name text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

-- Phase 1.1: optionale Spalten für bestehende bookings-Tabellen
alter table public.bookings add column if not exists item text;
alter table public.bookings add column if not exists booking_kind text;
alter table public.bookings add column if not exists employee_name text;

update public.bookings
set booking_kind = 'normal'
where booking_kind is null;

alter table public.bookings
  alter column booking_kind set default 'normal';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'booking_kind'
      and is_nullable = 'YES'
  ) then
    alter table public.bookings alter column booking_kind set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_booking_kind_check'
  ) then
    alter table public.bookings
      add constraint bookings_booking_kind_check
      check (booking_kind in ('normal', 'employee_advance'));
  end if;
end $$;

create index if not exists bookings_date_created_idx
  on public.bookings (date desc, created_at desc);

create index if not exists bookings_created_at_idx
  on public.bookings (created_at desc);

create index if not exists bookings_type_paid_by_idx
  on public.bookings (type, paid_by);

create index if not exists bookings_kind_employee_idx
  on public.bookings (booking_kind, employee_name);

-- created_by immer auf den eingeloggten Benutzer setzen
create or replace function public.bookings_before_insert()
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
  new.currency := 'TND';
  if new.booking_kind is null or btrim(new.booking_kind) = '' then
    new.booking_kind := 'normal';
  end if;
  if new.note is not null and btrim(new.note) = '' then
    new.note := null;
  end if;
  if new.item is not null and btrim(new.item) = '' then
    new.item := null;
  end if;
  if new.employee_name is not null and btrim(new.employee_name) = '' then
    new.employee_name := null;
  end if;
  if new.booking_kind = 'normal' then
    new.employee_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert
before insert on public.bookings
for each row execute procedure public.bookings_before_insert();

alter table public.bookings enable row level security;

revoke all on table public.bookings from anon, public;
grant select, insert, update, delete on table public.bookings to authenticated;

drop policy if exists "bookings_select_authenticated" on public.bookings;
drop policy if exists "bookings_insert_authenticated" on public.bookings;
drop policy if exists "bookings_update_authenticated" on public.bookings;
drop policy if exists "bookings_delete_authenticated" on public.bookings;

create policy "bookings_select_authenticated"
  on public.bookings
  for select
  to authenticated
  using (true);

create policy "bookings_insert_authenticated"
  on public.bookings
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "bookings_update_authenticated"
  on public.bookings
  for update
  to authenticated
  using (true)
  with check (created_by = auth.uid());

create policy "bookings_delete_authenticated"
  on public.bookings
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
      and tablename = 'bookings'
  ) then
    execute 'alter publication supabase_realtime add table public.bookings';
  end if;
end $$;

-- MixMax Manager – Phase 1.2: gemeinsame Mitarbeiterliste
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
