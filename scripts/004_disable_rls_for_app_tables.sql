-- Disable Row Level Security for application tables
-- These tables don't require RLS because this is a single-tenant admin application
-- without user authentication. The tables store business configuration and operational data.

ALTER TABLE api_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_history DISABLE ROW LEVEL SECURITY;

-- Add comments explaining the security model
COMMENT ON TABLE api_settings IS 'WhatsApp API configuration - RLS disabled for single-tenant admin access';
COMMENT ON TABLE webhook_messages IS 'Incoming webhook messages from Meta - RLS disabled for single-tenant admin access';
COMMENT ON TABLE message_history IS 'Outgoing message history - RLS disabled for single-tenant admin access';
