-- Add quoted_external_post_id column to posts table with matching collation
ALTER TABLE posts ADD COLUMN quoted_external_post_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER quoted_post_id;

-- Add index for quoted_external_post_id
CREATE INDEX idx_posts_quoted_external_post_id ON posts(quoted_external_post_id);
