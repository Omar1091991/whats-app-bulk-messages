-- Add preview_url column to store image data URLs for preview
ALTER TABLE uploaded_media 
ADD COLUMN IF NOT EXISTS preview_url TEXT;

COMMENT ON COLUMN uploaded_media.preview_url IS 'Data URL for image preview (base64 encoded)';
