-- Add media column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media JSON DEFAULT NULL;

-- Add media column to feed_channel_messages table
ALTER TABLE feed_channel_messages
ADD COLUMN IF NOT EXISTS media JSON DEFAULT NULL;

-- Add indexes for media queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_messages_media ON messages(sender_id) WHERE media IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_channel_messages_media ON feed_channel_messages(sender_id) WHERE media IS NOT NULL;
