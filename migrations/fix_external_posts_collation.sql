-- Migration: Fix collation for external posts sharing
-- Date: 2026-01-23
-- Description: Fixes collation mismatches to enable sharing external posts in messages

-- Step 1: Drop foreign key constraints that reference external_posts.post_id
-- Note: Adjust the constraint names if they're different in your database

-- Drop foreign key from external_posts_access if it exists
SET @fk_exists := (SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'external_posts_access'
    AND CONSTRAINT_NAME = 'fk_access_post'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');

SET @sqlstmt := IF(@fk_exists > 0,
    'ALTER TABLE `external_posts_access` DROP FOREIGN KEY `fk_access_post`',
    'SELECT ''FK fk_access_post does not exist''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop any other foreign keys that might exist
SET @fk_exists2 := (SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'external_posts_access'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME LIKE '%post%');

-- Step 2: Modify collations for external_posts.post_id
ALTER TABLE `external_posts`
MODIFY COLUMN `post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- Step 3: Modify collations for external_posts_access.post_id if needed
-- Note: This table has VARCHAR(36) but external_posts has VARCHAR(255) - they should match for proper foreign keys
-- If your external_posts_access actually stores full external post IDs, update the size too
ALTER TABLE `external_posts_access`
MODIFY COLUMN `post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- Step 4: Add or modify shared_external_post_id column in messages table
-- Check if column exists
SET @col_exists := (SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'messages'
    AND COLUMN_NAME = 'shared_external_post_id');

-- Drop if exists (to ensure correct collation)
SET @sqlstmt := IF(@col_exists > 0,
    'ALTER TABLE `messages` DROP COLUMN `shared_external_post_id`',
    'SELECT ''Column does not exist''');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add column with correct collation
ALTER TABLE `messages`
ADD COLUMN `shared_external_post_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER `shared_post_id`;

-- Step 5: Add index
CREATE INDEX `idx_shared_external_post_id` ON `messages` (`shared_external_post_id`);

-- Step 6: Recreate foreign key constraints if needed
-- Only recreate if the external_posts_access table actually needs a foreign key to external_posts
-- Uncomment if needed:
-- ALTER TABLE `external_posts_access`
-- ADD CONSTRAINT `fk_access_post`
-- FOREIGN KEY (`post_id`) REFERENCES `external_posts` (`post_id`) ON DELETE CASCADE;
