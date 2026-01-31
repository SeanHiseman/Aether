-- Master Migration Script v2
-- Description: Runs all migrations for saved posts channel feature
-- Date: 2026-01-31
--
-- IMPORTANT: Run diagnose_saved_posts.sql FIRST to get your constraint names!
-- Then update 002_update_saved_posts_for_channels_fixed.sql with your actual constraint names
--
-- Usage:
--   mysql -u [username] -p [database_name] < run_all_migrations_v2.sql

START TRANSACTION;

-- Migration 1: Create saved_external_posts table
-- This should work without issues
SOURCE 001_create_saved_external_posts.sql;

-- Migration 2: Update saved_posts table (MANUAL - requires your constraint names)
-- SKIP this in automated run - do it manually after running diagnose_saved_posts.sql
-- SOURCE 002_update_saved_posts_for_channels_fixed.sql;

-- Migration 3: Create Main channels for existing users
-- Run this AFTER migration 2 is complete
-- SOURCE 003_create_main_channels_for_existing_users.sql;

COMMIT;

-- Display message
SELECT 'Migration 1 complete. Now run diagnose_saved_posts.sql to get your constraint names!' as Status;
SELECT 'Then manually run migration 2 using the commands from QUICK_FIX.md' as NextSteps;
