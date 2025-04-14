import { BOOLEAN, STRING, DataTypes, INTEGER, TEXT } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Posts = sequelize.define('posts', {
    post_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true }, 
    feed_id: { type: STRING(36), allowNull: false }, 
    channel_id: { type: STRING(36), allowNull: false },
    title: { type: STRING(120), allowNull: true },
    content: { type: TEXT, allowNull: false },
    replies: { type: INTEGER, allowNull: false, defaultValue: 0 },
    views: { type: INTEGER, allowNull: false, defaultValue: 0 },
    upvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    downvotes: { type: INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    poster_id: { type: STRING(36), allowNull: false },
    points: { type: INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'posts', timestamps: false });

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

export {
    Posts,
    PostNotes,
    PostVotes,
    Prompts
}