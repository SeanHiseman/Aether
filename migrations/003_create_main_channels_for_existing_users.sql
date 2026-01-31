-- Migration: Create Main saved post channels for existing users
-- Description: Ensures all users who have saved posts get a Main channel
-- Date: 2026-01-31

-- Create Main channels for all users who have saved posts but no saved_post_channels
INSERT INTO saved_post_channels (channel_id, saver_id, channel_name, display_order, created_at, updated_at)
SELECT
    UUID() as channel_id,
    DISTINCT sp.saver_id,
    'Main' as channel_name,
    0 as display_order,
    NOW(3) as created_at,
    NOW(3) as updated_at
FROM saved_posts sp
LEFT JOIN saved_post_channels spc ON sp.saver_id = spc.saver_id AND spc.channel_name = 'Main'
WHERE spc.channel_id IS NULL
GROUP BY sp.saver_id;

-- Update existing saved_posts to reference their user's Main channel
-- This assumes saved_channel_id might be NULL or point to a non-existent channel
UPDATE saved_posts sp
INNER JOIN saved_post_channels spc
    ON sp.saver_id = spc.saver_id
    AND spc.channel_name = 'Main'
SET sp.saved_channel_id = spc.channel_id
WHERE sp.saved_channel_id IS NULL
   OR sp.saved_channel_id NOT IN (SELECT channel_id FROM saved_post_channels);
