-- Migration: Add Reposts Feature
-- Created: 2026-01-28
-- Description: Creates reposts table and adds repost_count to posts and external_posts

-- Create reposts table
CREATE TABLE IF NOT EXISTS reposts (
    repost_id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(255) NOT NULL,
    reposter_id VARCHAR(36) NOT NULL,
    is_external BOOLEAN DEFAULT FALSE,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_reposts_post_id (post_id),
    INDEX idx_reposts_reposter_id (reposter_id),
    INDEX idx_reposts_created_at (created_at),
    UNIQUE KEY unique_post_reposter (post_id, reposter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add repost_count column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS repost_count INT DEFAULT 0;

-- Add repost_count column to external_posts table
ALTER TABLE external_posts
ADD COLUMN IF NOT EXISTS repost_count INT DEFAULT 0;

-- Add index for repost_count on posts table (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_posts_repost_count ON posts(repost_count);

-- Add index for repost_count on external_posts table (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_external_posts_repost_count ON external_posts(repost_count);
