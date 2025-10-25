-- إنشاء جميع الجداول في قاعدة بيانات Neon
-- يجب تشغيل هذا السكريبت أولاً قبل نقل البيانات

-- جدول إعدادات API
CREATE TABLE IF NOT EXISTS api_settings (
    id SERIAL PRIMARY KEY,
    phone_number_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    business_account_id TEXT,
    webhook_verify_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- جدول الإحصائيات اليومية
CREATE TABLE IF NOT EXISTS daily_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_sent INTEGER DEFAULT 0,
    successful_messages INTEGER DEFAULT 0,
    failed_messages INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- جدول سجل الرسائل
CREATE TABLE IF NOT EXISTS message_history (
    id SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    message_text TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    template_name TEXT,
    media_url TEXT
);

-- جدول الرسائل المجدولة
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id SERIAL PRIMARY KEY,
    phone_numbers TEXT[] NOT NULL,
    message_text TEXT,
    template_name TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    media_url TEXT,
    error_message TEXT
);

-- جدول الوسائط المرفوعة
CREATE TABLE IF NOT EXISTS uploaded_media (
    id SERIAL PRIMARY KEY,
    media_id TEXT NOT NULL UNIQUE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- جدول رسائل Webhook
CREATE TABLE IF NOT EXISTS webhook_messages (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL UNIQUE,
    from_number TEXT NOT NULL,
    from_name TEXT,
    message_type TEXT NOT NULL,
    message_text TEXT,
    message_media_url TEXT,
    timestamp BIGINT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    conversation_status TEXT DEFAULT 'active'
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_message_history_phone ON message_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON message_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_time ON scheduled_messages(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_from ON webhook_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_timestamp ON webhook_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_webhook_messages_read ON webhook_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_date ON daily_statistics(date);

-- رسالة نجاح
SELECT 'تم إنشاء جميع الجداول بنجاح في Neon!' as message;
