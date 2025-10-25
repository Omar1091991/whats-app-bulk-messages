-- Create table for storing uploaded media
CREATE TABLE IF NOT EXISTS uploaded_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL UNIQUE,
  media_url TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_uploaded_media_uploaded_at ON uploaded_media(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_media_media_id ON uploaded_media(media_id);

-- Add comment
COMMENT ON TABLE uploaded_media IS 'Stores information about media files uploaded to WhatsApp';
