-- MixMax Manager – Phase 1
-- In der Supabase SQL-Konsole ausführen (einmalig).
-- Dashboard: SQL Editor → New query → gesamten Inhalt einfügen → Run.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in', 'out')),
  amount numeric(12, 3) not null check (amount > 0),
  currency text not null default 'TND' check (currency = 'TND'),
  category text not null check (char_length(btrim(category)) > 0),
  note text,
  date date not null,
  paid_by text not null check (paid_by in ('siraj', 'chedi', 'other')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create index if not exists bookings_date_created_idx
  on public.bookings (date desc, created_at desc);

create index if not exists bookings_created_at_idx
  on public.bookings (created_at desc);

create index if not exists bookings_type_paid_by_idx
  on public.bookings (type, paid_by);

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
  if new.note is not null and btrim(new.note) = '' then
    new.note := null;
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

-- Anonym: kein Zugriff (keine Policy für anon)
-- Authentifiziert: gemeinsames Buch für Siraj und Chedi

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

-- Realtime für INSERT / DELETE
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
