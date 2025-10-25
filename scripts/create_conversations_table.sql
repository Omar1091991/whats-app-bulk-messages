-- Create conversations table to permanently store conversation metadata
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  last_message_text TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  last_message_is_outgoing BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  has_incoming_messages BOOLEAN DEFAULT false,
  has_replies BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Migrate existing conversations from webhook_messages and message_history
INSERT INTO conversations (phone_number, contact_name, last_message_text, last_message_time, has_incoming_messages, has_replies, unread_count)
SELECT DISTINCT
  COALESCE(wm.from_number, mh.to_number) as phone_number,
  MAX(wm.from_name) as contact_name,
  (
    SELECT COALESCE(message_text, 'رسالة')
    FROM (
      SELECT message_text, created_at, 1 as priority FROM webhook_messages WHERE from_number = COALESCE(wm.from_number, mh.to_number)
      UNION ALL
      SELECT message_text, created_at, 2 as priority FROM message_history WHERE to_number = COALESCE(wm.from_number, mh.to_number)
    ) combined
    ORDER BY created_at DESC, priority ASC
    LIMIT 1
  ) as last_message_text,
  (
    SELECT MAX(created_at)
    FROM (
      SELECT created_at FROM webhook_messages WHERE from_number = COALESCE(wm.from_number, mh.to_number)
      UNION ALL
      SELECT created_at FROM message_history WHERE to_number = COALESCE(wm.from_number, mh.to_number)
    ) combined
  ) as last_message_time,
  EXISTS(SELECT 1 FROM webhook_messages WHERE from_number = COALESCE(wm.from_number, mh.to_number)) as has_incoming_messages,
  EXISTS(SELECT 1 FROM message_history WHERE to_number = COALESCE(wm.from_number, mh.to_number)) as has_replies,
  (SELECT COUNT(*) FROM webhook_messages WHERE from_number = COALESCE(wm.from_number, mh.to_number) AND replied = false) as unread_count
FROM webhook_messages wm
FULL OUTER JOIN message_history mh ON wm.from_number = mh.to_number
WHERE COALESCE(wm.from_number, mh.to_number) IS NOT NULL
GROUP BY COALESCE(wm.from_number, mh.to_number)
ON CONFLICT (phone_number) DO NOTHING;
