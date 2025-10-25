-- Create message_history table to store outgoing messages
CREATE TABLE IF NOT EXISTS message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  to_number TEXT NOT NULL,
  template_name TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_message_history_to_number ON message_history(to_number);
CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON message_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_message_id ON message_history(message_id);
CREATE INDEX IF NOT EXISTS idx_message_history_status ON message_history(status);

-- Add a comment to the table
COMMENT ON TABLE message_history IS 'Stores history of outgoing WhatsApp messages sent through the app';
