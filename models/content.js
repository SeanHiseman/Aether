import { BOOLEAN, DataTypes, FLOAT, INTEGER, STRING, TEXT } from 'sequelize';
import { Feeds } from './feeds.js';
import sequelize from '../databaseSetup.js';

const AppBuilds = sequelize.define('app_builds', {
    build_id: { type: DataTypes.STRING(36), primaryKey: true },
    post_id: { type: DataTypes.STRING(36), allowNull: true },
    kind: { type: DataTypes.ENUM('static', 'webcontainer'), defaultValue: 'static' },
    path: { type: DataTypes.STRING(255), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'app_builds', timestamps: false });

const Posts = sequelize.define('posts', {
    post_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true },
    feed_id: { type: STRING(36), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    title: { type: STRING(120), allowNull: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    replies: { type: INTEGER, allowNull: false, defaultValue: 0 },
    views: { type: INTEGER, allowNull: false, defaultValue: 0 },
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
}, {
    tableName: 'posts',
    timestamps: false,
    indexes: [
        { fields: ['channel_id'] },
        { fields: ['feed_id'] },
        { fields: ['has_images', 'has_videos', 'has_interactive', 'has_external_posts', 'has_embedded_websites'] },
        { fields: ['sentiment_score'] },
        { fields: ['created_at'] }, 
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
    Posts,
    PostDrafts,
    PostNotes,
    PostVotes,
    Prompts, 
    ViewedPosts
}