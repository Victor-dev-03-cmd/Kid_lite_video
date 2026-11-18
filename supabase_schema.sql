-- KidLite Phase 1 schema. Apply in Supabase SQL Editor to a NEW project.
-- Do not grant public anonymous access to private family/child data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  parent_pin_hash text,
  subscription_status text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  age_group text NOT NULL DEFAULT '6-9' CHECK (age_group IN ('2-5','6-9','10-12')),
  daily_limit_minutes integer NOT NULL DEFAULT 30 CHECK (daily_limit_minutes BETWEEN 15 AND 120),
  minutes_watched_today integer NOT NULL DEFAULT 0 CHECK (minutes_watched_today >= 0),
  last_reset_date date NOT NULL DEFAULT current_date,
  last_tick_at timestamptz,
  data_saver_mode boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS whitelisted_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_title text NOT NULL,
  category text CHECK (category IN ('Rhymes','Stories','Science','Shorts')),
  thumbnail_url text,
  UNIQUE (family_id, channel_id)
);
CREATE TABLE IF NOT EXISTS watch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  video_title text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  watched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS child_profiles_family_idx ON child_profiles(family_id);
CREATE INDEX IF NOT EXISTS channels_family_idx ON whitelisted_channels(family_id);
CREATE INDEX IF NOT EXISTS watch_logs_child_date_idx ON watch_logs(child_id, watched_at DESC);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelisted_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_logs ENABLE ROW LEVEL SECURITY;
-- Intentionally NO anon/authenticated access policies.
-- Phase 2's verified Clerk backend uses a server-only Supabase service role.
