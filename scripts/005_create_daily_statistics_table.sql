-- Create daily_statistics table to store aggregated daily stats
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  
  -- Message counts by type
  total_sent INTEGER DEFAULT 0,
  single_messages INTEGER DEFAULT 0,
  bulk_instant_messages INTEGER DEFAULT 0,
  bulk_scheduled_messages INTEGER DEFAULT 0,
  reply_messages INTEGER DEFAULT 0,
  
  -- Status counts
  successful_messages INTEGER DEFAULT 0,
  failed_messages INTEGER DEFAULT 0,
  pending_messages INTEGER DEFAULT 0,
  
  -- Incoming messages
  incoming_messages INTEGER DEFAULT 0,
  
  -- Templates
  unique_templates INTEGER DEFAULT 0,
  
  -- Scheduled messages
  scheduled_pending INTEGER DEFAULT 0,
  scheduled_completed INTEGER DEFAULT 0,
  scheduled_failed INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster date queries
CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(date DESC);

-- Add a comment to the table
COMMENT ON TABLE daily_statistics IS 'Stores aggregated daily statistics for dashboard historical data';
