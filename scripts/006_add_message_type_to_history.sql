-- Add message_type column to message_history table to track source
ALTER TABLE message_history 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'single';

-- Add index for faster queries by message type
CREATE INDEX IF NOT EXISTS idx_message_history_message_type ON message_history(message_type);

-- Add comment
COMMENT ON COLUMN message_history.message_type IS 'Type of message: single, bulk_instant, bulk_scheduled, reply';

-- Add media_url and error_message columns if they don't exist (for older schemas)
ALTER TABLE message_history 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;
