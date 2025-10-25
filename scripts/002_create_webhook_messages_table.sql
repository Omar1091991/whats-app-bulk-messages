-- Create webhook_messages table to store incoming messages from Meta webhooks
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_messages_from_number ON webhook_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_timestamp ON webhook_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_status ON webhook_messages(status);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_message_id ON webhook_messages(message_id);

-- Add a comment to the table
COMMENT ON TABLE webhook_messages IS 'Stores incoming WhatsApp messages received via webhooks';
