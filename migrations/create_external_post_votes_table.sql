-- Migration: Create external_post_votes table
-- Date: 2026-01-24
-- Description: Adds table to track user votes/likes on external posts from Reddit, Bluesky, and Mastodon

CREATE TABLE IF NOT EXISTS external_post_votes (
    vote_id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    source VARCHAR(32) NOT NULL,
    vote_type ENUM('upvote', 'downvote', 'like') NOT NULL,
    synced_to_platform BOOLEAN DEFAULT FALSE,
    platform_uri TEXT,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_user_id (user_id),
    INDEX idx_post_id (post_id),
    INDEX idx_source (source),
    UNIQUE INDEX idx_user_post (user_id, post_id)
);
