-- Migration: Update saved_posts table for multi-channel support
-- Description: Changes primary key to support saving the same post to multiple channels
-- Date: 2026-01-31

-- Drop the old primary key constraint
ALTER TABLE saved_posts DROP PRIMARY KEY;

-- Add composite primary key that includes saved_channel_id
-- This allows the same post to be saved to multiple channels
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);

-- Add foreign key constraint for saved_channel_id if it doesn't exist
-- First check if the constraint exists, if not add it
ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_channel
FOREIGN KEY (saved_channel_id)
REFERENCES saved_post_channels(channel_id)
ON DELETE CASCADE;

-- Add index for better query performance on saved_channel_id
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
