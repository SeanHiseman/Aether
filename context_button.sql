-- Make post_id nullable (can be NULL for external posts)
ALTER TABLE post_notes MODIFY COLUMN post_id VARCHAR(36) NULL;

-- Add external_post_id column
ALTER TABLE post_notes ADD COLUMN external_post_id VARCHAR(255) NULL AFTER post_id;

-- Increase note_content length
ALTER TABLE post_notes MODIFY COLUMN note_content VARCHAR(5000) NOT NULL;

-- Add index on external_post_id
ALTER TABLE post_notes ADD INDEX idx_post_notes_external_post_id (external_post_id);
