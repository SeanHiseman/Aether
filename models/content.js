import { BOOLEAN, DataTypes, FLOAT, INTEGER, STRING, TEXT } from 'sequelize';
import { Feeds } from './feeds.js';
import sequelize from '../databaseSetup.js';

const AppBuilds = sequelize.define('app_builds', {
    build_id: { type: STRING(36), primaryKey: true },
    post_id: { type: STRING(36), allowNull: true },
    kind: { type: DataTypes.ENUM('static', 'webcontainer'), defaultValue: 'static' },
    path: { type: STRING(255), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'app_builds', timestamps: false });

const ExternalPosts = sequelize.define('ExternalPosts', {
	post_id: { type: STRING(255), primaryKey: true },
	source: { type: STRING(32), allowNull: true },
	source_post_id: { type: STRING(128), allowNull: true },
	title: { type: TEXT, allowNull: true },
    content: { type: TEXT, allowNull: true },
	text_body: { type: TEXT, allowNull: true },
	text_length: { type: INTEGER, allowNull: true },
	word_count: { type: INTEGER, allowNull: true },
	image_count: { type: INTEGER, allowNull: true },
	video_count: { type: INTEGER, allowNull: true },
    has_text: { type: BOOLEAN, defaultValue: false },
	has_images: { type: BOOLEAN, defaultValue: false },
	has_videos: { type: BOOLEAN, defaultValue: false },
	score: { type: INTEGER, allowNull: true },
    replies: { type: INTEGER, allowNull: true },
    sentiment_score: { type: FLOAT, allowNull: true },
	embeddings: { type: DataTypes.JSON, allowNull: true },
	fetched_at: { type: DataTypes.DATE, allowNull: true },
	created_at_remote: { type: DataTypes.DATE, allowNull: true },
	expired: { type: BOOLEAN, defaultValue: false },
	channel: { type: STRING(128), allowNull: true },
	author: { type: STRING(190), allowNull: true }, 
    author_photo: { type: TEXT, allowNull: true },
	url: { type: TEXT, allowNull: true },
	media: { type: DataTypes.JSON, allowNull: true }
}, {
	tableName: 'external_posts',
    timestamps: false, 
    indexes: [
        { fields: ['created_at_remote'] },
        { fields: ['score'] },
        { fields: ['source'] },
        { fields: ['expired'] },
        { fields: ['fetched_at'] },
        { name: 'idx_ext_posts_word_count', fields: ['word_count'] },
    ]
});

const ExternalPostsAccess = sequelize.define('ExternalPostsAccess', {
	id: { type: STRING(255), primaryKey: true },
	user_id: { type: STRING(36), allowNull: false },
	post_id: { type: STRING(255), allowNull: false },
    source: { type: STRING(20), allowNull: false },
	created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
	tableName: 'external_posts_access',
	timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['post_id'] },
        { fields: ['source'] },
        { fields: ['user_id', 'post_id'], unique: true },
    ]
});

const PaginationTokens = sequelize.define('PaginationTokens', {
    id: { type: STRING(36), primaryKey: true },
	user_id: { type: STRING(36), allowNull: false },
	platform: { type: STRING(20), allowNull: false },
	cursor: { type: TEXT, allowNull: true }, //Bluesky
	after: { type: STRING(255), allowNull: true }, //Reddit
	max_id: { type: STRING(255), allowNull: true }, //Mastodon
	updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
	tableName: 'pagination_tokens',
	timestamps: false,
	indexes: [
		{ fields: ['user_id', 'platform'], unique: true }
	]
});

const Posts = sequelize.define('posts', {
    post_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true },
    feed_id: { type: STRING(36), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    title: { type: STRING(120), allowNull: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    replies: { type: INTEGER, allowNull: false, defaultValue: 0 },
    views: { type: INTEGER, allowNull: false, defaultValue: 0 },
    rank_hotness: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: null },
    rank_updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    upvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    downvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    poster_id: { type: STRING(36), allowNull: false },
    text_body: { type: DataTypes.TEXT('long'), allowNull: false },
    text_length: { type: INTEGER, defaultValue: 0 }, //Character count
    word_count: { type: INTEGER, defaultValue: 0 }, 
    video_length: { type: DataTypes.FLOAT, defaultValue: 0 },
    sentence_count: { type: INTEGER, defaultValue: 0 },
    has_images: { type: BOOLEAN, defaultValue: false },
    has_videos: { type: BOOLEAN, defaultValue: false },
    has_interactive: { type: BOOLEAN, defaultValue: false },
    has_external_posts: { type: BOOLEAN, defaultValue: false },
    has_embedded_websites: { type: BOOLEAN, defaultValue: false },
    has_text: { type: BOOLEAN, defaultValue: false },
    image_count: { type: INTEGER, defaultValue: 0 },
    video_count: { type: INTEGER, defaultValue: 0 },
    sentiment_score: { type: FLOAT, defaultValue: 0.0 }, 
    language: { type: STRING(20), defaultValue: 'en' },
    tokens: { type: DataTypes.JSON, allowNull: false },
    embeddings: { type: DataTypes.JSON, allowNull: true },
    is_private: { type: BOOLEAN, defaultValue: false },
    boost_amount: { type: FLOAT, defaultValue: 1.0 }, 
}, {
    tableName: 'posts',
    timestamps: false,
    indexes: [
        { name: 'idx_posts_parent_id', fields: ['parent_id'] }, 
        { name: 'idx_posts_poster_id', fields: ['poster_id'] },
        { name: 'idx_feed_id', fields: ['feed_id'] }, 
        { name: 'idx_channel_id', fields: ['channel_id'] },
        { name: 'idx_feed_rank', fields: ['feed_id', { attribute: 'rank_hotness', order: 'DESC' }, 'post_id'] },
        { name: 'idx_feed_created', fields: ['feed_id', { attribute: 'created_at', order: 'DESC' }, 'post_id'] },
        { name: 'idx_rank_hotness_desc', fields: [{ attribute: 'rank_hotness', order: 'DESC' }, 'post_id'] },
        { name: 'idx_created_desc', fields: [{ attribute: 'created_at', order: 'DESC' }, 'post_id'] },
        { name: 'idx_fulltext_posts', type: 'FULLTEXT', fields: ['title', 'text_body'] },
        { name: 'idx_feed_videos', fields: ['feed_id', 'has_videos'] },
        { name: 'idx_sentiment', fields: ['sentiment_score'] },
        { name: 'idx_posts_word_count', fields: ['word_count'] },
        { name: 'idx_posts_video_length', fields: ['video_length'] },
    ]
});

const PostDrafts = sequelize.define('post_drafts', {
    draft_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true },
    feed_id: { type: STRING(36), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    title: { type: STRING(120), allowNull: true },
    content: { type: TEXT, allowNull: false },
    poster_id: { type: STRING(36), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate : sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'post_drafts', timestamps: false, indexes: [{ fields: ['channel_id'] }] });

const PostNotes = sequelize.define('post_notes', {
    note_id: { type: STRING(36), primaryKey: true },
    post_id: { type: STRING(36), allowNull: false, references: { model: 'posts', key: 'post_id' }},
    note_content: { type: STRING(1000), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    is_misinfo: { type: BOOLEAN, defaultValue: false},
}, { tableName: 'post_notes', timestamps: false });

const PostVotes = sequelize.define('post_votes', {
    vote_id: { type: STRING(36), primaryKey: true },
    post_id: { type: STRING(36), allowNull: false },
    voter_id: { type: STRING(36), allowNull: false },
    upvotes: {type: INTEGER, defaultValue: 0},
    downvotes: {type: INTEGER, defaultValue: 0},
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'post_votes', timestamps: false });

const Prompts = sequelize.define('prompts', {
    prompt_id: { type: STRING(36), primaryKey: true },
    prompt_content: { type: STRING(100000), allowNull: false },
    response_content: { type: STRING(100000), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'prompts', timestamps: false });

const ViewedPosts = sequelize.define('viewed_posts', {
    post_id: { type: STRING(36), primaryKey: true, references: { model: Posts, key: 'post_id' }},
    viewer_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    views: { type: INTEGER, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'viewed_posts', timestamps: false });

export {
    AppBuilds, 
    ExternalPosts,
    ExternalPostsAccess,
    PaginationTokens,
    Posts,
    PostDrafts,
    PostNotes,
    PostVotes,
    Prompts, 
    ViewedPosts
}