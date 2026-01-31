# Manual Migration Guide for saved_posts Table

If you're getting foreign key errors, follow these steps manually.

## Step 1: Find Your Constraint Names

Run this query to see your current table structure:

```sql
SHOW CREATE TABLE saved_posts;
```

You'll see output like:
```sql
CREATE TABLE `saved_posts` (
  ...
  CONSTRAINT `saved_posts_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE,
  CONSTRAINT `saved_posts_ibfk_2` FOREIGN KEY (`saver_id`) REFERENCES `feeds` (`feed_id`) ON DELETE CASCADE,
  ...
)
```

**Write down all the CONSTRAINT names** (e.g., `saved_posts_ibfk_1`, `saved_posts_ibfk_2`, etc.)

## Step 2: Drop Foreign Keys One by One

Replace `CONSTRAINT_NAME` with the actual names from Step 1:

```sql
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_3;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_4;
-- Add more if you have more constraints
```

## Step 3: Drop the Primary Key

```sql
ALTER TABLE saved_posts DROP PRIMARY KEY;
```

## Step 4: Add New Primary Key

```sql
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);
```

## Step 5: Re-add Foreign Keys

```sql
ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_post
FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_saver
FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_feed
FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_parent_channel
FOREIGN KEY (channel_id) REFERENCES feed_channels(channel_id) ON DELETE CASCADE;

ALTER TABLE saved_posts
ADD CONSTRAINT fk_saved_posts_saved_channel
FOREIGN KEY (saved_channel_id) REFERENCES saved_post_channels(channel_id) ON DELETE CASCADE;
```

## Step 6: Add Index

```sql
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
```

## Step 7: Verify

```sql
SHOW CREATE TABLE saved_posts;
```

The output should show:
- Primary key: `(post_id, saver_id, saved_channel_id)`
- All 5 foreign key constraints
- Index on `saved_channel_id`

## Alternative: Use the Helper Script

If you want to see what constraints exist before dropping them:

```sql
SELECT
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'saved_posts'
AND REFERENCED_TABLE_NAME IS NOT NULL;
```

This will show you exactly which constraints to drop.

## Common Issues

### Issue: "Cannot drop index needed in a foreign key constraint"
**Solution:** Drop the foreign keys first, then the primary key.

### Issue: "Duplicate key name 'idx_saved_posts_channel'"
**Solution:** The index already exists. Skip step 6 or drop it first:
```sql
DROP INDEX idx_saved_posts_channel ON saved_posts;
```

### Issue: "Foreign key constraint is incorrectly formed"
**Solution:** Make sure `saved_post_channels` table exists and has `channel_id` as a column.
```sql
SHOW TABLES LIKE 'saved_post_channels';
DESCRIBE saved_post_channels;
```
