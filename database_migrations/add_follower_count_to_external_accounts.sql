-- Migration: Add follower_count to external_account_meta table
-- Date: 2025-02-06
-- Purpose: Enable accountSizePreference feature for external posts

-- Add follower_count column
ALTER TABLE external_account_meta
ADD COLUMN follower_count INT DEFAULT 0 AFTER post_count;

-- Add index for performance (optional but recommended)
CREATE INDEX idx_external_account_follower_count ON external_account_meta(follower_count);

-- Verify the column was added
DESCRIBE external_account_meta;
