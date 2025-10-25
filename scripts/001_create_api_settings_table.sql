-- Create api_settings table to store WhatsApp API configuration
CREATE TABLE IF NOT EXISTS api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_settings_created_at ON api_settings(created_at DESC);

-- Add a comment to the table
COMMENT ON TABLE api_settings IS 'Stores WhatsApp Business API configuration settings';
