-- Migration: Add cid column to external_posts table
-- Date: 2026-01-24
-- Description: Adds CID (Content Identifier) column for Bluesky posts to enable proper liking

ALTER TABLE external_posts
ADD COLUMN cid VARCHAR(128) NULL AFTER media;