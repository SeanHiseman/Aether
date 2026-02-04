# Media Upload Implementation for Chat Messages

## Overview
Added media attachment capability to both direct messages and feed chat channels. Users can attach one piece of media (image or video) per message, subject to the same membership-based size constraints as posts.

## Backend Changes

### 1. Database Models
- **models/messages.js**
  - Added `media` field (JSON) to Messages model

- **models/feeds.js**
  - Added `media` field (JSON) to FeedChannelMessages model

### 2. Routes - directMessages.js
**New Imports:**
- Added multer, fs, path, S3 handling functions (UploadToS3, DeleteFromS3)
- Added GenerateFileName utility
- Created media directory at `/media/messages`

**New Middleware:**
- `checkStorageLimit`: Enforces 30GB/300MB weekly limits based on membership
- `messageFilter`: Validates file types and sizes
  - Images: 500MB (members) / 5MB (non-members)
  - Videos: 10GB (members) / 100MB (non-members)
  - Allowed types: JPEG, PNG, GIF, WebP, AVIF, HEIC, HEIF, MP4, MOV, WebM, MKV

**New Route:**
- `POST /upload_message_media`: Handles media file uploads
  - Accepts up to 10 files (frontend limits to 1)
  - In production: Uploads to S3 with prefix `message-media/` and returns CloudFront URL
  - In development: Saves to local `/media/messages/` directory
  - Returns array of media objects with URLs
  - Cleans up files on error (deletes from S3 or local filesystem)

**Updated Socket Handler:**
- `send_direct_message`: Now accepts `media` array in message object
  - Allows empty content if media is present
  - Stores media in database with message
- `delete_direct_message`: Now deletes media from S3/filesystem before deleting message
  - Parses media URLs and deletes from S3 in production
  - Deletes from local filesystem in development

### 3. Routes - feeds.js
**Updated Socket Handlers:**
- `send_feed_message`: Now accepts `media` array in message object
  - Allows empty content if media is present
  - Stores media in database with message
- `delete_feed_message`: Now deletes media from S3/filesystem before deleting message
  - Parses media URLs and deletes from S3 in production
  - Deletes from local filesystem in development

### 4. Database Migration
- **migrations/add_media_to_messages.sql**
  - Adds `media` (JSON) column to both messages and feed_channel_messages tables
  - Creates indexes for media queries (optional, for performance)
  - Run: `mysql -u user -p database < migrations/add_media_to_messages.sql`

## Frontend Changes

### 1. Components - chatChannel.js
**New State:**
- `attachedMedia`: Stores selected file
- `mediaPreview`: Preview data for selected media
- `isUploadingMedia`: Upload progress indicator
- `fileInputRef`: Reference to hidden file input

**New Functions:**
- `handleFileSelect`: Validates and previews selected media
  - Checks file type and size
  - Creates preview URL
- `removeMedia`: Clears attached media and preview
- `uploadMedia`: Uploads media to server before sending message

**Updated Functions:**
- `sendMessage`: Now async, uploads media first if attached
  - Validates message has content or media
  - Uploads media and gets URL
  - Includes media array in socket message

**New UI Elements:**
- Media preview with remove button
- Paperclip button to attach media
- Upload progress indicator
- Updated send button with loading state

### 2. Components - message.js
**New Rendering:**
- Added media display section
- Renders images and videos from `message.media` array
- Images: Clickable to open in new tab
- Videos: Inline player with controls
- Responsive sizing (max 400px height)

### 3. Styles - messageMedia.css
**New Styles:**
- Media preview container with remove button
- Attachment button styling
- Message media display (images/videos)
- Responsive adjustments for mobile
- Hover effects and transitions

## Media Storage Format

Messages store media as JSON array:
```json
{
  "media": [
    {
      "url": "https://cloudfront-domain.com/message-media/abc123.jpg",
      "type": "image",
      "mimetype": "image/jpeg",
      "size": 1024000
    }
  ]
}
```

**Production (S3):**
- Files uploaded to S3 bucket with prefix `message-media/`
- URLs format: `https://{CLOUDFRONT_DOMAIN}/message-media/{filename}`
- Deleted from S3 when message is deleted

**Development (Local):**
- Files saved to `/media/messages/` directory
- URLs format: `/media/messages/{filename}`
- Deleted from filesystem when message is deleted

## Usage Flow

1. **Attach Media**
   - Click paperclip button
   - Select image or video file
   - Preview appears below input
   - Click X to remove

2. **Send Message**
   - Type optional message text
   - Click Send (or press Enter)
   - Media uploads automatically
   - Message sent with media URL

3. **View Media**
   - Images: Click to open full size
   - Videos: Play inline with controls
   - Displayed in message bubble

## Constraints

- **One media file per message** (enforced in UI)
- **Same size limits as posts**:
  - Members: 500MB images, 10GB videos
  - Non-members: 5MB images, 100MB videos
- **Weekly storage limits**:
  - Members: 30GB
  - Non-members: 300MB
- **Supported formats**:
  - Images: JPEG, PNG, GIF, WebP, AVIF, HEIC, HEIF
  - Videos: MP4, MOV, WebM, MKV

## Testing Checklist

- [ ] Run database migration
- [ ] Test media upload in direct messages
- [ ] Test media upload in feed chat channels
- [ ] Test size limit enforcement (member vs non-member)
- [ ] Test file type validation
- [ ] Test media preview and removal
- [ ] Test sending message with media only (no text)
- [ ] Test sending message with both media and text
- [ ] Test media display for images
- [ ] Test media display for videos
- [ ] Test storage limit enforcement
- [ ] Test error handling (upload failures, invalid files)
- [ ] Test responsive design on mobile

## Notes

- Media editing not implemented (can't change media after sending)
- Media persists when editing message text
- Old messages without media continue to work normally
- Frontend limits to 1 file, but backend accepts up to 10 (for future enhancement)

## Important: Before Using in Production

**Database Migration:**
Before using this feature, you MUST run the database migration to add the `media` and `edited_at` columns:
```bash
mysql -u [username] -p [database_name] < migrations/add_media_to_messages.sql
```

**S3 Configuration:**
Ensure your `.env` file has the following variables set for production:
- `CLOUDFRONT_DOMAIN`: Your CloudFront distribution domain
- S3 credentials and bucket configuration (as used by UploadToS3/DeleteFromS3 functions)

**Testing:**
After migration, test both:
1. Media upload and display in production environment
2. Message deletion properly removes media from S3
