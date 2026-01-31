-- Rollback Migration: Revert saved posts channel changes
-- Description: Rollback all changes made for saved posts channel feature
-- WARNING: This will delete all saved_external_posts data
-- Date: 2026-01-31

-- Drop the saved_external_posts table
DROP TABLE IF EXISTS saved_external_posts;

-- Restore original saved_posts primary key
ALTER TABLE saved_posts DROP PRIMARY KEY;
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id);

-- Drop the saved_channel_id foreign key constraint
ALTER TABLE saved_posts DROP FOREIGN KEY fk_saved_posts_channel;

-- Drop the index
DROP INDEX idx_saved_posts_channel ON saved_posts;

-- Note: We don't delete saved_post_channels or Main channels
-- as this could cause data loss. If you need to remove these,
-- run the following manually:
-- DELETE FROM saved_post_channels WHERE channel_name != 'Main';
-- Or to remove all:
-- DROP TABLE saved_post_channels;
