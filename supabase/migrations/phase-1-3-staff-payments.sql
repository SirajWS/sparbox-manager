-- MixMax Manager – Phase 1.3
-- Nur im bestehenden Supabase-Projekt ausführen.
-- Erweitert booking_kind um salary, tip und other_staff.
-- bookings-Daten werden nicht gelöscht, nicht zurückgesetzt und nicht verändert.
-- Bestehende employee_advance-Buchungen bleiben unverändert.
-- employees, Auth und Realtime bleiben unverändert.

alter table public.bookings
  drop constraint if exists bookings_booking_kind_check;

alter table public.bookings
  add constraint bookings_booking_kind_check
  check (booking_kind in ('normal', 'employee_advance', 'salary', 'tip', 'other_staff'));
