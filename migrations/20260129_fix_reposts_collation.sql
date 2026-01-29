-- Migration: Fix Reposts Collation Mismatch
-- Created: 2026-01-29
-- Description: Fixes collation mismatch between reposts and other tables

-- Option 1: Change reposts table to use utf8mb4_general_ci (matching most tables)
-- This is the safer option if your existing tables use utf8mb4_general_ci

ALTER TABLE reposts
MODIFY COLUMN repost_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
MODIFY COLUMN post_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
MODIFY COLUMN reposter_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE reposts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- If the above doesn't work or you want all tables to use utf8mb4_unicode_ci (more accurate),
-- comment out the above and uncomment the section below:

-- Option 2: Change all tables to use utf8mb4_unicode_ci (more modern and accurate)
-- Uncomment if you want to standardize on unicode_ci:

/*
-- Update posts table
ALTER TABLE posts
MODIFY COLUMN post_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN parent_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN quoted_post_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN quoted_external_post_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN feed_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN channel_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
MODIFY COLUMN poster_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Update feeds table
ALTER TABLE feeds
MODIFY COLUMN feed_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE feeds CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Update external_posts table
ALTER TABLE external_posts
MODIFY COLUMN post_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE external_posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
*/
