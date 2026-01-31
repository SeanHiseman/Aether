-- Migration: Update saved_posts table for multi-channel support (AUTO-DETECT)
-- Description: Automatically detects and drops existing constraints before modifying primary key
-- Date: 2026-01-31

-- First, let's see what constraints exist (for reference)
-- Run this query separately first to see your constraint names:
-- SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
-- FROM information_schema.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saved_posts' AND REFERENCED_TABLE_NAME IS NOT NULL;

-- IMPORTANT: Replace the constraint names below with your actual constraint names
-- You can find them by running: SHOW CREATE TABLE saved_posts;

-- Step 1: Drop all existing foreign key constraints
-- Replace these names with your actual constraint names from SHOW CREATE TABLE
SET @sql = NULL;
SELECT GROUP_CONCAT(CONCAT('ALTER TABLE saved_posts DROP FOREIGN KEY ', constraint_name) SEPARATOR '; ')
INTO @sql
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
AND table_name = 'saved_posts'
AND referenced_table_name IS NOT NULL;

SET @sql = CONCAT(@sql, ';');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Drop the old primary key
ALTER TABLE saved_posts DROP PRIMARY KEY;

-- Step 3: Add the new composite primary key
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);

-- Step 4: Re-add foreign key constraints with standard names
ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_post
FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_saver
FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_feed
FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_parent_channel
FOREIGN KEY (channel_id) REFERENCES feed_channels(channel_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_saved_channel
FOREIGN KEY (saved_channel_id) REFERENCES saved_post_channels(channel_id) ON DELETE CASCADE;

-- Step 5: Add index for performance
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
