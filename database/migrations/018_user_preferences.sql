-- Add a preferences JSONB column to the profiles table
ALTER TABLE profiles
ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
