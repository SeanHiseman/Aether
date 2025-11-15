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
	post_id: { type: STRING(36), primaryKey: true },
	source: { type: STRING(32), allowNull: false },
	source_post_id: { type: STRING(128), allowNull: false },
	parent_id: { type: STRING(128), allowNull: true },
	title: { type: TEXT, allowNull: true },
	text_body: { type: TEXT, allowNull: true },
	text_length: { type: INTEGER, allowNull: true },
	word_count: { type: INTEGER, allowNull: true },
	image_count: { type: INTEGER, allowNull: true },
	video_count: { type: INTEGER, allowNull: true },
	has_images: { type: BOOLEAN, defaultValue: false },
	has_videos: { type: BOOLEAN, defaultValue: false },
	score: { type: INTEGER, allowNull: true },
    replies: { type: INTEGER, allowNull: true },
	hotness: { type: FLOAT, allowNull: true },
	embedding: { type: DataTypes.JSON, allowNull: true },
	is_private: { type: BOOLEAN, defaultValue: false },
	fetched_at: { type: DataTypes.DATE, allowNull: false },
	created_at_remote: { type: DataTypes.DATE, allowNull: false },
	expired: { type: BOOLEAN, defaultValue: false },
	channel: { type: STRING(128), allowNull: true },
	author: { type: STRING(190), allowNull: true },
    author_photo: { type: TEXT, allowNull: true },
	url: { type: TEXT, allowNull: false },
	media: { type: DataTypes.JSON, allowNull: true }
}, {
	tableName: 'external_posts',
	underscored: true,
    timestamps: false, 
	indexes: [
		{ fields: ['parent_id'] },
		{ fields: ['is_private'] },
		{ fields: ['created_at_remote'] },
		{ fields: ['hotness'] },
		{ fields: ['score'] },
		{ fields: ['source'] },
		{ fields: ['expired'] },
		{ fields: ['fetched_at'] },
		{ fields: ['source', 'user_id'] },
		{ fields: ['source', 'created_at_remote'] },
		{ fields: ['user_id', 'created_at_remote'] }
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
    rank_hotness: { type: FLOAT, allowNull: true, defaultValue: null },
    rank_updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    upvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    downvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    poster_id: { type: STRING(36), allowNull: false },
    text_body: { type: DataTypes.TEXT('long'), allowNull: true },
    text_length: { type: INTEGER, defaultValue: 0 }, //Character count
    word_count: { type: INTEGER, defaultValue: 0 }, 
    video_length: { type: INTEGER, defaultValue: 0 },
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
    tokens: { type: DataTypes.TEXT('long'), allowNull: true }, 
    embeddings: { type: DataTypes.TEXT('long'), allowNull: true }, 
    is_private: { type: BOOLEAN, defaultValue: false },
}, {
    tableName: 'posts',
    timestamps: false,
	indexes: [
		{ name: 'idx_feed_id', fields: ['feed_id'] },
		{ name: 'idx_channel_id', fields: ['channel_id'] },
		{ name: 'idx_media_flags', fields: ['has_images', 'has_videos', 'has_interactive', 'has_external_posts', 'has_embedded_websites'] },
		{ name: 'idx_sentiment', fields: ['sentiment_score'] },
		{ name: 'idx_composite_quality', fields: ['created_at', 'sentiment_score'] },
		{ name: 'idx_video_content', fields: ['has_videos', 'video_length'] },
		{ name: 'idx_text_analysis', fields: ['word_count', 'text_length'] },
		{ name: 'idx_rank_hotness_desc', fields: ['rank_hotness', 'post_id'] },
		{ name: 'idx_feed_rank', fields: ['feed_id', 'rank_hotness', 'post_id'] },
		{ name: 'idx_created_desc', fields: ['created_at', 'post_id'] },
		{ name: 'idx_fulltext_posts', type: 'FULLTEXT', fields: ['title', 'text_body'] }
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
    Posts,
    PostDrafts,
    PostNotes,
    PostVotes,
    Prompts, 
    ViewedPosts
}