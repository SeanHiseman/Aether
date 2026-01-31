# Complete Migration Sequence - Step by Step

Follow these steps in order to successfully migrate your database.

## Prerequisites

- Backup your database first!
- You have MariaDB/MySQL command-line access
- You know your database credentials

## Step 1: Create saved_external_posts Table

This one is safe and has no dependencies:

```bash
mysql -u your_username -p your_database < migrations/001_create_saved_external_posts.sql
```

**Expected output:** Table created successfully

---

## Step 2: Diagnose saved_posts Table

Before modifying the primary key, we need to know the current constraint names:

```bash
mysql -u your_username -p your_database < migrations/diagnose_saved_posts.sql > diagnosis.txt
```

Open `diagnosis.txt` and look for the section:
```
COPY THESE COMMANDS TO DROP FOREIGN KEYS:
==========================================
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
...
```

**Copy those commands** - you'll need them in the next step.

---

## Step 3: Update saved_posts Table

Create a file called `my_migration_002.sql` with this content:

```sql
-- PASTE THE DROP FOREIGN KEY COMMANDS FROM diagnosis.txt HERE
-- For example:
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_1;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_2;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_3;
ALTER TABLE saved_posts DROP FOREIGN KEY saved_posts_ibfk_4;

-- Drop the old primary key
ALTER TABLE saved_posts DROP PRIMARY KEY;

-- Add new composite primary key
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

-- Add index for performance
CREATE INDEX idx_saved_posts_channel ON saved_posts(saved_channel_id);
```

Then run it:

```bash
mysql -u your_username -p your_database < my_migration_002.sql
```

**Verify it worked:**
```sql
SHOW CREATE TABLE saved_posts;
```

You should see: `PRIMARY KEY (post_id,saver_id,saved_channel_id)`

---

## Step 4: Create Main Channels for Existing Users

```bash
mysql -u your_username -p your_database < migrations/003_create_main_channels_for_existing_users_fixed.sql
```

This will:
- Create a Main channel for every user who has saved posts
- Link existing saved posts to their user's Main channel

**Expected output:** "Main channels created successfully"

---

## Step 5: Verify Everything

Run the verification script:

```bash
mysql -u your_username -p your_database < migrations/verify_migrations.sql
```

You should see:
- ✓ PASS: saved_external_posts table exists
- ✓ PASS: saved_posts has correct composite primary key
- ✓ PASS: saved_channel_id foreign key exists
- ✓ PASS: Main channels exist
- ✓ PASS: All indexes exist on saved_external_posts

---

## Quick One-Liner (After Creating my_migration_002.sql)

```bash
mysql -u user -p db < migrations/001_create_saved_external_posts.sql && \
mysql -u user -p db < my_migration_002.sql && \
mysql -u user -p db < migrations/003_create_main_channels_for_existing_users_fixed.sql && \
mysql -u user -p db < migrations/verify_migrations.sql
```

---

## Troubleshooting

### "Table 'saved_post_channels' doesn't exist"
Run this first:
```sql
CREATE TABLE saved_post_channels (
    channel_id      CHAR(36)    NOT NULL PRIMARY KEY,
    saver_id        CHAR(36)    NOT NULL,
    channel_name    VARCHAR(50) NOT NULL,
    display_order   INT         NOT NULL DEFAULT 0,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY saver_channel (saver_id, channel_name),
    FOREIGN KEY (saver_id) REFERENCES feeds(feed_id) ON DELETE CASCADE
) ENGINE = InnoDB;
```

### "Duplicate entry" errors
You already have Main channels. Skip step 4 or delete duplicates first:
```sql
SELECT saver_id, COUNT(*) as count
FROM saved_post_channels
WHERE channel_name = 'Main'
GROUP BY saver_id
HAVING count > 1;
```

### Foreign key errors in step 4
Make sure step 3 completed successfully first.

---

## Rollback (If Needed)

```bash
mysql -u your_username -p your_database < migrations/rollback_saved_posts_channels.sql
```

**WARNING:** This will delete all data in saved_external_posts!

---

## Summary

After all migrations:
- saved_external_posts table created ✓
- saved_posts primary key updated ✓
- All users have Main channel ✓
- Ready to use the saved posts channel feature ✓
