-- Migration: Create saved_external_posts table
-- Description: Adds support for saving external posts (from Reddit, Bluesky, Mastodon) to channels
-- Date: 2026-01-31

-- Create saved_external_posts table
CREATE TABLE IF NOT EXISTS saved_external_posts (
    save_id             CHAR(36)        NOT NULL PRIMARY KEY,
    post_id             VARCHAR(255)    NOT NULL,
    saver_id            CHAR(36)        NOT NULL,
    saved_channel_id    CHAR(36)        NOT NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    -- Indexes for performance
    INDEX idx_post_id (post_id),
    INDEX idx_saver_id (saver_id),
    INDEX idx_saved_channel_id (saved_channel_id),

    -- Unique constraint to prevent duplicate saves of the same post to the same channel
    UNIQUE KEY unique_save (post_id, saver_id, saved_channel_id),

    -- Foreign keys
    FOREIGN KEY (post_id) REFERENCES external_posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE,
    FOREIGN KEY (saved_channel_id) REFERENCES saved_post_channels(channel_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
