-- Migration 010: Add meeting provider/link columns to profiles
alter table public.profiles
  add column if not exists meeting_provider text,
  add column if not exists meeting_link    text;