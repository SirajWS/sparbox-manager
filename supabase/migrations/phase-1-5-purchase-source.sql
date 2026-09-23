-- MixMax Manager – Phase 1.5
-- Additive only. Does not change, rename, or delete existing bookings.

alter table public.bookings
  add column if not exists purchase_source text;
