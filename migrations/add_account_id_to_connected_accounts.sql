-- Migration: Add account_id column to connected_accounts table
-- Date: 2026-01-24
-- Description: Adds account_id column to store platform-specific user IDs (DID for Bluesky, numeric ID for Mastodon)

ALTER TABLE connected_accounts
ADD COLUMN account_id VARCHAR(255) NULL AFTER handle;
