-- Add reply_text and reply_sent_at columns to webhook_messages table
ALTER TABLE webhook_messages
ADD COLUMN IF NOT EXISTS reply_text TEXT,
ADD COLUMN IF NOT EXISTS reply_sent_at TIMESTAMP WITH TIME ZONE;

-- Add message_text column to message_history table if it doesn't exist
ALTER TABLE message_history
ADD COLUMN IF NOT EXISTS message_text TEXT;
