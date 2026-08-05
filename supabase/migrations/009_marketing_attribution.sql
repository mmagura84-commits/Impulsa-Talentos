-- Migration 009: Add marketing attribution fields to profiles
alter table public.profiles
  add column if not exists source        text,
  add column if not exists email_consent boolean not null default false;