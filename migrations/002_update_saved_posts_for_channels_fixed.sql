-- Migration: Update saved_posts table for multi-channel support (FIXED)
-- Description: Changes primary key to support saving the same post to multiple channels
-- Date: 2026-01-31

-- Step 1: Drop existing foreign key constraints on saved_posts
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_3;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_4;

-- Step 2: Drop the old primary key
ALTER TABLE saved_posts DROP PRIMARY KEY;

-- Step 3: Add the new composite primary key that includes saved_channel_id
-- This allows the same post to be saved to multiple channels
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);

-- Step 4: Re-add the foreign key constraints
ALTER TABLE saved_posts
ADD CONSTRAINT saved_posts_ibfk_1
FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT saved_posts_ibfk_2
FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT saved_posts_ibfk_3
FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT saved_posts_ibfk_4
FOREIGN KEY (channel_id) REFERENCES feed_channels(channel_id) ON DELETE CASCADE;

-- Step 5: Add foreign key constraint for saved_channel_id
ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_channel
FOREIGN KEY (saved_channel_id)
REFERENCES saved_post_channels(channel_id)
ON DELETE CASCADE;

-- Step 6: Add index for better query performance on saved_channel_id
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
