-- Migration 011: Add preferred_location_type to profiles for candidate work-mode preference.
alter table public.profiles
  add column if not exists preferred_location_type text;
