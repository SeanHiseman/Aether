# Database Migrations for Saved Posts Channels

This directory contains migrations for the saved posts channel feature that allows users to organize both native and external posts into custom channels.

## Overview

The migrations add support for:
- Saving external posts (Reddit, Bluesky, Mastodon) to channels
- Multi-channel saves (same post saved to multiple channels)
- Channel management (create, rename, delete, reorder)
- Automatic Main channel creation for all users

## Migration Files

### 001_create_saved_external_posts.sql
Creates the `saved_external_posts` table to store external post saves.

**Changes:**
- New table: `saved_external_posts`
- Indexes for performance
- Foreign keys to `external_posts`, `feeds`, and `saved_post_channels`

### 002_update_saved_posts_for_channels.sql
Updates the `saved_posts` table to support multi-channel saves.

**Changes:**
- Updates primary key from `(post_id, saver_id)` to `(post_id, saver_id, saved_channel_id)`
- Adds foreign key constraint for `saved_channel_id`
- Adds index for better query performance

### 003_create_main_channels_for_existing_users.sql
Creates Main channels for existing users who have saved posts.

**Changes:**
- Creates Main channel for users with saved posts
- Migrates existing saved posts to Main channel

## Running Migrations

### Option 1: Run all migrations at once
```bash
mysql -u [username] -p [database_name] < migrations/run_all_migrations.sql
```

### Option 2: Run individual migrations
```bash
mysql -u [username] -p [database_name] < migrations/001_create_saved_external_posts.sql
mysql -u [username] -p [database_name] < migrations/002_update_saved_posts_for_channels.sql
mysql -u [username] -p [database_name] < migrations/003_create_main_channels_for_existing_users.sql
```

### Option 3: From MySQL prompt
```sql
USE your_database_name;
SOURCE /path/to/migrations/001_create_saved_external_posts.sql;
SOURCE /path/to/migrations/002_update_saved_posts_for_channels.sql;
SOURCE /path/to/migrations/003_create_main_channels_for_existing_users.sql;
```

## Rollback

If you need to rollback the changes:
```bash
mysql -u [username] -p [database_name] < migrations/rollback_saved_posts_channels.sql
```

**WARNING:** Rollback will delete all data in `saved_external_posts` table.

## Verification

After running migrations, verify the changes:

```sql
-- Check saved_external_posts table
DESCRIBE saved_external_posts;

-- Check saved_posts primary key
SHOW CREATE TABLE saved_posts;

-- Check saved_post_channels
SELECT COUNT(*) as main_channels FROM saved_post_channels WHERE channel_name = 'Main';

-- Verify data integrity
SELECT
    sp.saver_id,
    COUNT(DISTINCT sp.saved_channel_id) as channels_used,
    COUNT(*) as total_saves
FROM saved_posts sp
GROUP BY sp.saver_id;
```

## Troubleshooting

### Foreign Key Constraint Errors
If you get foreign key errors, ensure tables are created in the correct order:
1. `saved_post_channels` must exist before `saved_posts`
2. `external_posts` must exist before `saved_external_posts`

### Duplicate Entry Errors
If migration 003 fails with duplicate entries:
```sql
-- Clean up duplicate Main channels manually
DELETE FROM saved_post_channels
WHERE channel_id NOT IN (
    SELECT * FROM (
        SELECT MIN(channel_id)
        FROM saved_post_channels
        WHERE channel_name = 'Main'
        GROUP BY saver_id
    ) as keep
)
AND channel_name = 'Main';
```

## Database Schema After Migration

### saved_posts
- Primary Key: `(post_id, saver_id, saved_channel_id)`
- Allows same post to be saved to multiple channels

### saved_external_posts (NEW)
- Stores external post saves
- References: `external_posts`, `feeds`, `saved_post_channels`

### saved_post_channels
- No changes
- Stores user's custom save channels

## Notes

- The `Main` channel is special and cannot be deleted or renamed
- All migrations run in a transaction for safety
- Existing saved posts are automatically migrated to Main channel
- The feature is backward compatible - old code will continue to work
