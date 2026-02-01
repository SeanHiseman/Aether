-- Performance indexes for explore page pagination
-- Run this with: mysql -u your_user -p your_database < add_explore_indexes.sql

-- Indexes for explore page native posts
-- Covers: parent_id, is_private, and ORDER BY columns
CREATE INDEX idx_posts_explore_hotness
ON posts(parent_id, is_private, rank_hotness DESC, post_id);

CREATE INDEX idx_posts_explore_chronological
ON posts(parent_id, is_private, created_at DESC, post_id);

-- Indexes for external posts by platform
CREATE INDEX idx_external_posts_bluesky
ON external_posts(source, expired, created_at_remote DESC, post_id);

CREATE INDEX idx_external_posts_reddit
ON external_posts(source, expired, created_at_remote DESC, post_id);

CREATE INDEX idx_external_posts_mastodon
ON external_posts(source, expired, created_at_remote DESC, post_id);

-- Composite index for score-based ordering
CREATE INDEX idx_external_posts_score
ON external_posts(source, expired, score DESC, created_at_remote DESC, post_id);

SELECT 'Indexes created successfully' AS status;
