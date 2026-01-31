# Quick Fix for Foreign Key Error

## Run This First (Diagnostic)

```bash
mysql -u your_username -p your_database < diagnose_saved_posts.sql
```

This will show you:
1. Your current table structure
2. Exact foreign key constraint names
3. Commands to copy/paste

## Then Follow These Steps

### Step 1: Get Your Constraint Names

Look at the output from the diagnostic script under "COPY THESE COMMANDS TO DROP FOREIGN KEYS"

It will show something like:
```sql
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_3;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_4;
```

### Step 2: Run the Complete Migration

Copy the commands from the diagnostic output and run them, then continue with:

```sql
-- Drop primary key
ALTER TABLE saved_posts DROP PRIMARY KEY;

-- Add new primary key
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);

-- Re-add foreign keys with new names
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

-- Add index
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
```

### Step 3: Verify

```sql
SHOW CREATE TABLE saved_posts;
```

You should see:
- PRIMARY KEY (`post_id`,`saver_id`,`saved_channel_id`)
- 5 CONSTRAINT entries for foreign keys

## One-Line Solution (If you're confident)

Run diagnostic first, copy the DROP FOREIGN KEY commands it generates, then:

```bash
# Create a file with your specific constraint names
cat > /tmp/fix_saved_posts.sql << 'EOF'
-- Replace these with YOUR constraint names from diagnostic output
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_3;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_4;

ALTER TABLE saved_posts DROP PRIMARY KEY;
ALTER TABLE saved_posts ADD PRIMARY KEY (post_id, saver_id, saved_channel_id);

ALTER TABLE saved_posts ADD CONSTRAINT fk_saved_posts_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE;
ALTER TABLE saved_posts ADD CONSTRAINT fk_saved_posts_saver FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;
ALTER TABLE saved_posts ADD CONSTRAINT fk_saved_posts_feed FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE;
ALTER TABLE saved_posts ADD CONSTRAINT fk_saved_posts_parent_channel FOREIGN KEY (channel_id) REFERENCES feed_channels(channel_id) ON DELETE CASCADE;
ALTER TABLE saved_posts ADD CONSTRAINT fk_saved_posts_saved_channel FOREIGN KEY (saved_channel_id) REFERENCES saved_post_channels(channel_id) ON DELETE CASCADE;

CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
EOF

# Run it
mysql -u your_username -p your_database < /tmp/fix_saved_posts.sql
```

## Need Help?

If you're still getting errors:
1. Share the output of `diagnose_saved_posts.sql`
2. Check if `saved_post_channels` table exists: `SHOW TABLES LIKE 'saved_post_channels';`
3. Check the full error message
