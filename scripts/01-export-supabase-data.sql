-- Export all data from Supabase tables
-- Run this script in Supabase SQL Editor to export data

-- Export api_settings
COPY (SELECT * FROM api_settings) TO STDOUT WITH CSV HEADER;

-- Export daily_statistics  
COPY (SELECT * FROM daily_statistics) TO STDOUT WITH CSV HEADER;

-- Export message_history
COPY (SELECT * FROM message_history) TO STDOUT WITH CSV HEADER;

-- Export scheduled_messages
COPY (SELECT * FROM scheduled_messages) TO STDOUT WITH CSV HEADER;

-- Export uploaded_media
COPY (SELECT * FROM uploaded_media) TO STDOUT WITH CSV HEADER;

-- Export webhook_messages
COPY (SELECT * FROM webhook_messages) TO STDOUT WITH CSV HEADER;
