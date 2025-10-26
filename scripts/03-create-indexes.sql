-- Create indexes for better query performance on Supabase

-- Index for webhook_messages table
CREATE INDEX IF NOT EXISTS idx_webhook_messages_from_number ON public.webhook_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_timestamp ON public.webhook_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_replied ON public.webhook_messages(replied);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_from_number_timestamp ON public.webhook_messages(from_number, timestamp DESC);

-- Index for message_history table
CREATE INDEX IF NOT EXISTS idx_message_history_to_number ON public.message_history(to_number);
CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON public.message_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_status ON public.message_history(status);
CREATE INDEX IF NOT EXISTS idx_message_history_to_number_created_at ON public.message_history(to_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_media_url ON public.message_history(media_url) WHERE media_url IS NOT NULL;

-- Index for uploaded_media table
CREATE INDEX IF NOT EXISTS idx_uploaded_media_media_id ON public.uploaded_media(media_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_media_created_at ON public.uploaded_media(created_at DESC);

-- Index for scheduled_messages table
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON public.scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_time ON public.scheduled_messages(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_scheduled_time ON public.scheduled_messages(status, scheduled_time);

-- Index for daily_statistics table
CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON public.daily_statistics(date DESC);

-- Index for api_settings table (usually small, but good to have)
CREATE INDEX IF NOT EXISTS idx_api_settings_phone_number_id ON public.api_settings(phone_number_id);

-- Analyze tables to update statistics
ANALYZE public.webhook_messages;
ANALYZE public.message_history;
ANALYZE public.uploaded_media;
ANALYZE public.scheduled_messages;
ANALYZE public.daily_statistics;
ANALYZE public.api_settings;
