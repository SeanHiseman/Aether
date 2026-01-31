-- Master Migration Script
-- Description: Runs all migrations for saved posts channel feature
-- Date: 2026-01-31
--
-- Usage:
--   mysql -u [username] -p [database_name] < run_all_migrations.sql
--
-- Or from MySQL prompt:
--   source /path/to/run_all_migrations.sql;

START TRANSACTION;

-- Migration 1: Create saved_external_posts table
SOURCE 001_create_saved_external_posts.sql;

-- Migration 2: Update saved_posts table for multi-channel support
SOURCE 002_update_saved_posts_for_channels.sql;

-- Migration 3: Create Main channels for existing users
SOURCE 003_create_main_channels_for_existing_users.sql;

COMMIT;

-- Display success message
SELECT 'All migrations completed successfully!' as Status;

-- Show table status
SELECT
    'saved_posts' as table_name,
    COUNT(*) as row_count
FROM saved_posts
UNION ALL
SELECT
    'saved_external_posts' as table_name,
    COUNT(*) as row_count
FROM saved_external_posts
UNION ALL
SELECT
    'saved_post_channels' as table_name,
    COUNT(*) as row_count
FROM saved_post_channels;
