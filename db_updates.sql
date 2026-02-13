-- Add new columns for Security & Audio Control features

-- 1. Add OpenAI API Key column (encrypted if possible, but text for now as per prototype)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS openai_api_key text;

-- 2. Add Settings Password column
-- Default password is '1234'
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS settings_password text DEFAULT '1234';

-- 3. Comment on columns
COMMENT ON COLUMN organizations.openai_api_key IS 'User provided OpenAI API Key. Overrides Env var.';
COMMENT ON COLUMN organizations.settings_password IS 'Password to access the Settings page.';

-- Updated at 2026-02-13 15:35

-- Phase 11: Fish Audio Integration
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fish_api_key text;
COMMENT ON COLUMN organizations.fish_api_key IS 'API Key for Fish Audio integration.';
