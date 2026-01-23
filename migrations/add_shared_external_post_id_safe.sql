-- Migration: Add shared_external_post_id to messages table (Safe version)
-- Date: 2026-01-23
-- Description: Adds support for sharing external posts with proper collation handling

-- First, ensure external_posts.post_id uses utf8mb4_0900_ai_ci collation
ALTER TABLE `external_posts`
MODIFY COLUMN `post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- Drop the column if it exists (in case it was added with wrong collation)
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'shared_external_post_id');
SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE `messages` DROP COLUMN `shared_external_post_id`', 'SELECT ''Column does not exist''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add the new column with matching collation
ALTER TABLE `messages`
ADD COLUMN `shared_external_post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER `shared_post_id`;

-- Add index for better query performance
CREATE INDEX `idx_shared_external_post_id` ON `messages` (`shared_external_post_id`);
