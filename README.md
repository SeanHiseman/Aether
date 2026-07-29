# Aether Social

Aether Social is a social media platform built around user-configurable ranking algorithms — instead of a single fixed feed algorithm, each user (or "viewer") can define and apply their own scoring logic to determine what content they see, and where. It also aggregates content from external platforms (Bluesky, Mastodon, Reddit) alongside native posts.

## Tech stack

**Backend**
- Node.js + Express (ES modules)
- MySQL via [Sequelize](https://sequelize.org/) ORM
- [Socket.IO](https://socket.io/) for realtime features (direct messages, feed chat, connect requests)
- Passport.js (Google OAuth + local email/password) with `express-session` + JWT for email verification/password reset
- AWS S3 (`@aws-sdk/client-s3`) for media storage, served via CloudFront
- Stripe for subscription billing
- `node-cron` for scheduled jobs (e.g. batch hotness recalculation)
- NLP/embeddings: `wink-nlp`, `natural`, `sentiment`, `@xenova/transformers`, plus OpenAI/Anthropic/xAI API clients for AI-assisted features (content analysis, "Ask" chatbot)

**Frontend**
- React (in `frontend/`), built separately and served as static files by the Express app
- MUI (`@mui/material`) component library
- Socket.IO client for realtime updates

## Core concepts

- **Feeds, not just users.** Most interactions (following, posting, voting, messaging) happen through a `feed_id`, not a `user_id`. Every user has an associated feed representing their profile, and feeds can also represent groups (`is_group: true`). `user_id` is only used for account ownership/auth — following, content, and social graph relationships are all keyed on `feed_id`.
- **Deep feeds.** Combined/aggregated feeds (internally still referred to in places as "deep feeds") let a user merge multiple feeds or accounts into one view.
- **Custom algorithms** (`custom_algorithms/`). Users can define their own post-ranking algorithm per "location" (e.g. main feed, a specific deep feed, explore, search). An algorithm record (`algorithms` table) stores a boost/suppress embedding and optional custom instructions; `applyAlgorithm.js` is the shared entry point every content-fetching route calls through, which:
  1. Delegates to a `fetchHandlers/*` function based on the location (default feed, following, explore, search, deep feed, external account, platform-specific).
  2. Scores and paginates candidates (`algorithmFunctions/computeAlgorithmScore.js`, `scoreAndPaginateCandidates.js`) using cosine similarity against the algorithm's embeddings.
  3. Attaches parent/quoted post data, vote counts, saved/repost state for the viewer, then strips internal-only attributes before returning.
  - This subsystem originated from, and overlaps with, Sean Hiseman's Customisable Social Media Algorithms Master's project — that code lives in `custom_algorithms/`, `frontend/src/algorithms/`, or is marked with `//Project code` elsewhere.
- **External platform integration** (`functions/external_posts/`). Fetches, normalizes, and periodically refreshes posts/tokens for connected Bluesky, Mastodon, and Reddit accounts, mapping each platform's post shape into a common internal format so they can be ranked and rendered alongside native posts.

## Naming conventions

- Variables defined in application code use `camelCase` (e.g. `userId`); variables originating from the database use `snake_case` (e.g. `user_id`) — the casing is a signal for where a value came from.
- File names use `camelCase` starting with a lowercase letter (e.g. `fileName.js`). Folders are lowercase with underscores (e.g. `folder_name`).
- File sizes are checked against storage limits in megabytes.

## Project structure

```
app.js                  Express app entry point: middleware, routes, Socket.IO setup
databaseSetup.js        Sequelize connection (MySQL)
dbStructure.sql         Full database schema (run this to create a local DB)
routes/                 Express route handlers (auth, content, feeds, messaging, social connections, Stripe webhook)
models/                 Sequelize model definitions
functions/              Shared server-side logic
  calculation/          Scoring helpers (cosine similarity, batch hotness calculation)
  checks/               Auth/permission/rate-limit middleware
  external_posts/        Fetching, mapping, and token refresh for Bluesky/Mastodon/Reddit
  media_handling/        S3 upload/delete helpers
custom_algorithms/      User-defined ranking algorithm system (see above)
frontend/               React application (built separately, served statically by app.js)
markdowns/              Design/implementation notes for the algorithm system
media/                  Local media storage (gitignored subfolders)
```

## Setup

1. Install dependencies: `npm install` (root) and `npm install` inside `frontend/`.
2. Create a MySQL database and run `dbStructure.sql` against it to create the schema.
3. Create a `.env` file in the project root. Variables read by the backend include:

   ```
   # Server
   APP_PORT, APP_SECRET, NODE_ENV, FRONTEND_URL
   APP_BUILD_DIR, FAVICON_PATH, FRONTEND_BUILD_DIR, MEDIA_DIR

   # Database
   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

   # Auth
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
   JWT_SECRET, ENCRYPTION_SECRET_KEY, ADMIN_ID

   # Media storage
   AWS_BUCKET_NAME, AWS_REGION, CLOUDFRONT_DOMAIN
   DEFAULT_USER_IMAGE, DEFAULT_GROUP_IMAGE

   # Email
   BREVO_SMTP_USER, BREVO_SMTP_KEY

   # Billing
   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
   STRIPE_MONTHLY_PRICE_ID, STRIPE_YEARLY_PRICE_ID
   (plus _TEST_ variants for non-production Stripe)

   # External platform integration
   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI
   MASTODON_REDIRECT_URI

   # AI features
   ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY

   # Frontend (consumed by the React build)
   REACT_APP_SOCKET_URL, REACT_APP_WC_PORT
   ```

4. Run the backend: `npm run dev` (nodemon) or `npm start`.
5. Build/run the frontend from `frontend/` per its own `package.json`.

Other scripts:
- `npm run batch-calc-hot` — recalculates post "hotness" scores in batch (also runs on a schedule via `node-cron`).
- `npm run create-test-data` / `npm run delete-test-data` — generate or remove synthetic test data for algorithm development.

## Currently paused features

The following are present in the codebase but not currently active/maintained:
- App build uploads
- Ask chatbot
- Ask notes
- Multi voting (more than one up/down vote per post)
- Clicking to edit dynamic content
- Connections
- Messaging
- Branched replies
- Replies accessing parent post code
- Expand content height chevron
- Saved post channels
