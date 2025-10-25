-- Create scheduled_messages table for storing scheduled bulk messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Scheduling information
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  
  -- Message details
  template_name TEXT NOT NULL,
  phone_numbers TEXT[] NOT NULL, -- Array of phone numbers
  
  -- Template parameters (stored as JSONB for flexibility)
  template_params JSONB,
  
  -- Media information (if applicable)
  media_type TEXT, -- IMAGE, VIDEO, DOCUMENT
  media_url TEXT,
  media_id TEXT,
  
  -- Execution tracking
  total_numbers INTEGER NOT NULL,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create index for efficient querying of pending messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_time 
ON scheduled_messages(status, scheduled_time);

-- Create index for querying by scheduled time
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_time 
ON scheduled_messages(scheduled_time);
