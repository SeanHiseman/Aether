-- Migration: Add shared_external_post_id to messages table
-- Date: 2026-01-23
-- Description: Adds support for sharing external posts (from Reddit, Bluesky, Mastodon) in direct messages

-- First, ensure external_posts.post_id uses utf8mb4_0900_ai_ci collation
ALTER TABLE `external_posts`
MODIFY COLUMN `post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- Add the new column with matching collation
ALTER TABLE `messages`
ADD COLUMN `shared_external_post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER `shared_post_id`;

-- Add index for better query performance
CREATE INDEX `idx_shared_external_post_id` ON `messages` (`shared_external_post_id`);
