-- Create api_settings table to store WhatsApp API credentials
CREATE TABLE IF NOT EXISTS api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_messages table to store incoming messages from Meta
CREATE TABLE IF NOT EXISTS webhook_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  from_name TEXT,
  message_type TEXT NOT NULL,
  message_text TEXT,
  message_media_url TEXT,
  message_media_mime_type TEXT,
  timestamp BIGINT NOT NULL,
  status TEXT DEFAULT 'unread',
  replied BOOLEAN DEFAULT FALSE,
  reply_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_history table to track sent messages
CREATE TABLE IF NOT EXISTS message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  to_number TEXT NOT NULL,
  template_name TEXT,
  message_text TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_webhook_messages_from_number ON webhook_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_status ON webhook_messages(status);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_timestamp ON webhook_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_to_number ON message_history(to_number);
CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_api_settings_updated_at
  BEFORE UPDATE ON api_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default API settings if none exist (using environment variables as defaults)
-- Note: This will be updated by the user through the settings page
INSERT INTO api_settings (business_account_id, phone_number_id, access_token, webhook_verify_token)
SELECT 
  '1096746608955840',
  '623846684149569',
  'placeholder_token',
  'placeholder_verify_token'
WHERE NOT EXISTS (SELECT 1 FROM api_settings LIMIT 1);
