-- Create profiles table
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          app_role NOT NULL DEFAULT 'OPERATIONS_AGENT',
  hub_city      TEXT,           -- For agents: their assigned hub city
  store_id      TEXT,           -- For STORE_MANAGER: their store
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
