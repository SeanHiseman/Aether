-- Verification Script for Saved Posts Channel Migrations
-- Run this after migrations to verify everything is set up correctly

SELECT '========================================' as '';
SELECT 'SAVED POSTS CHANNELS MIGRATION VERIFICATION' as '';
SELECT '========================================' as '';

-- Check if saved_external_posts table exists
SELECT '1. Checking if saved_external_posts table exists...' as '';
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✓ PASS: saved_external_posts table exists'
        ELSE '✗ FAIL: saved_external_posts table does not exist'
    END as result
FROM information_schema.tables
WHERE table_schema = DATABASE()
AND table_name = 'saved_external_posts';

-- Check saved_posts primary key
SELECT '' as '';
SELECT '2. Checking saved_posts primary key...' as '';
SELECT
    CASE
        WHEN COLUMN_KEY = 'PRI' AND COLUMN_NAME IN ('post_id', 'saver_id', 'saved_channel_id')
        THEN '✓ PASS: saved_posts has correct composite primary key'
        ELSE '✗ FAIL: saved_posts primary key is incorrect'
    END as result
FROM information_schema.columns
WHERE table_schema = DATABASE()
AND table_name = 'saved_posts'
AND COLUMN_KEY = 'PRI'
LIMIT 1;

-- Check saved_channel_id foreign key
SELECT '' as '';
SELECT '3. Checking saved_channel_id foreign key...' as '';
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✓ PASS: saved_channel_id foreign key exists'
        ELSE '✗ FAIL: saved_channel_id foreign key is missing'
    END as result
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
AND table_name = 'saved_posts'
AND column_name = 'saved_channel_id'
AND referenced_table_name = 'saved_post_channels';

-- Check if Main channels were created
SELECT '' as '';
SELECT '4. Checking Main channels for users...' as '';
SELECT
    COUNT(*) as main_channels_created,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ PASS: Main channels exist'
        ELSE '⚠ WARNING: No Main channels found (may be normal if no saved posts)'
    END as result
FROM saved_post_channels
WHERE channel_name = 'Main';

-- Check saved_external_posts indexes
SELECT '' as '';
SELECT '5. Checking saved_external_posts indexes...' as '';
SELECT
    CASE
        WHEN COUNT(*) >= 3 THEN '✓ PASS: All indexes exist on saved_external_posts'
        ELSE '✗ FAIL: Some indexes are missing on saved_external_posts'
    END as result
FROM information_schema.statistics
WHERE table_schema = DATABASE()
AND table_name = 'saved_external_posts'
AND index_name IN ('idx_post_id', 'idx_saver_id', 'idx_saved_channel_id');

-- Show table statistics
SELECT '' as '';
SELECT '========================================' as '';
SELECT 'TABLE STATISTICS' as '';
SELECT '========================================' as '';

SELECT 'saved_posts' as table_name, COUNT(*) as row_count
FROM saved_posts
UNION ALL
SELECT 'saved_external_posts' as table_name, COUNT(*) as row_count
FROM saved_external_posts
UNION ALL
SELECT 'saved_post_channels' as table_name, COUNT(*) as row_count
FROM saved_post_channels;

-- Show Main channels per user
SELECT '' as '';
SELECT 'Main channels by user:' as '';
SELECT
    f.feed_name,
    spc.channel_name,
    spc.created_at
FROM saved_post_channels spc
JOIN feeds f ON f.feed_id = spc.saver_id
WHERE spc.channel_name = 'Main'
ORDER BY spc.created_at DESC
LIMIT 10;

-- Check for orphaned saved posts
SELECT '' as '';
SELECT '========================================' as '';
SELECT 'DATA INTEGRITY CHECKS' as '';
SELECT '========================================' as '';

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ PASS: No orphaned saved posts'
        ELSE CONCAT('✗ FAIL: ', COUNT(*), ' saved posts have invalid channel references')
    END as result
FROM saved_posts sp
LEFT JOIN saved_post_channels spc ON sp.saved_channel_id = spc.channel_id
WHERE spc.channel_id IS NULL;

SELECT '' as '';
SELECT '========================================' as '';
SELECT 'VERIFICATION COMPLETE' as '';
SELECT '========================================' as '';
