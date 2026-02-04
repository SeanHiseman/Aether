import { BOOLEAN, DATE, DataTypes, STRING, INTEGER, TEXT } from 'sequelize';
import sequelize from '../databaseSetup.js';
import { Users } from "./users.js";

const DeepFeeds = sequelize.define('deep_feeds', {
    deep_feed_id: { type: STRING(36), primaryKey: true },
    name: { type: STRING(36), allowNull: false },
    owner_id: { type: STRING(36), allowNull: false },  
    parent_id: { type: STRING(36), allowNull: true, references: { model: 'DeepFeeds', key: 'deep_feed_id' } },
}, { tableName: 'deep_feeds', timestamps: false });

const DeepFeedContent = sequelize.define('deep_feed_content', {
    content_id: { type: STRING(36), primaryKey: true },
    deep_feed_id: { type: STRING(36), allowNull: false, references: { model: 'DeepFeeds', key: 'deep_feed_id' } },
    feed_id: { type: STRING(36), allowNull: true },
    external_did: { type: STRING(255), allowNull: true },
}, { tableName: 'deep_feed_content', timestamps: false });

const Feeds = sequelize.define('feeds', {
    feed_id: { type: STRING(36), primaryKey: true },
    feed_name: { type: STRING(100), allowNull: false },
    description: { type: STRING(1000), allowNull: true },
    feed_photo: { type: TEXT, allowNull: true },
    follower_count: { type: INTEGER, defaultValue: 0 },
    follow_requests: { type: INTEGER, defaultValue: 0 },
    connections: { type: INTEGER, defaultValue: 0 },
    connect_requests: { type: INTEGER, defaultValue: 0 },
    post_count: { type: INTEGER, defaultValue: 0 },
    type: { type: STRING(10), defaultValue: 'public' },
    is_group: { type: BOOLEAN, defaultValue: false },
    feed_owner: { type: STRING(36), allowNull: false, references: { model: Users, key: 'user_id' } },
    is_locked: { type: BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
	tableName: 'feeds',
	timestamps: false,
	indexes: [
		{ fields: ['feed_owner'] },
        { fields: ['follower_count', 'created_at'] },
		{ name: 'idx_fulltext_feeds', type: 'FULLTEXT', fields: ['feed_name', 'description'] }
	]
});

const FeedChannels = sequelize.define('feed_channels', { 
    channel_id: { type: STRING(36), primaryKey: true }, 
    channel_name: { type: STRING(100), allowNull: false },     
    description: { type: STRING(1000), allowNull: true },
    feed_id: { type: STRING(36), allowNull: false }, 
    is_posts: { type: BOOLEAN, defaultValue: true},
    is_chat: { type: BOOLEAN, defaultValue: true},
    display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    post_count: { type: INTEGER, defaultValue: 0 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'feed_channels', timestamps: false }); 

const FeedChannelMessages = sequelize.define('feed_channel_messages', {
    message_id: { type: STRING(36), primaryKey: true },
    content: { type: STRING(1000), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    sender_id: { type: STRING(36), allowNull: false},
    media: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'feed_channel_messages', timestamps: false });

const FeedChannelViews = sequelize.define('feed_channel_views', {
    view_id: { type: STRING(36), primaryKey: true },
    viewer_id: { type: STRING(36), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    last_seen_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, {
    tableName: 'feed_channel_views',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['viewer_id', 'channel_id'] },
        { fields: ['channel_id'] }
    ]
});

const Followers = sequelize.define('followers', {
    follow_id: { type: STRING(36), primaryKey: true },
    follower_id: { type: STRING(36), allowNull: false },
    feed_id: { type: STRING(36), allowNull: false },
    is_mod: { type: BOOLEAN, defaultValue: false },
    is_admin: { type: BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'followers', timestamps: false });

const ExternalFollows = sequelize.define('ExternalFollows', {
    id: { type: STRING(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: STRING(36), allowNull: false },
    did: { type: STRING(255), allowNull: false },
    handle: { type: STRING(255), allowNull: false },
    display_name: { type: STRING(255), allowNull: true },
    avatar: { type: TEXT, allowNull: true },
    description: { type: TEXT, allowNull: true },
    platform: { type: STRING(255), allowNull: false },
    created_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
    tableName: 'external_follows',
    underscored: true,
    timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { unique: true, fields: ['user_id', 'did'] }
    ]
});  

const FollowRequests = sequelize.define('follow_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false},
    receiver_id: { type: STRING(36), allowNull: false},
    timestamp: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'follow_requests', timestamps: false });

const SavedPosts = sequelize.define('saved_posts', {
    save_id: { type: STRING(36), primaryKey: true },
    post_id: { type: STRING(36), allowNull: false },
    saver_id: { type: STRING(36), allowNull: false },
    feed_id: { type: STRING(36), allowNull: false },
    channel_id: { type: STRING(36), allowNull: false },
    saved_channel_id: { type: STRING(36), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate : sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
    tableName: 'saved_posts',
    timestamps: false,
    indexes: [
        { fields: ['post_id'] },
        { fields: ['saver_id'] },
        { fields: ['saved_channel_id'] },
        { unique: true, fields: ['post_id', 'saver_id', 'saved_channel_id'] }
    ]
});

const SavedPostChannels = sequelize.define('saved_post_channels', {
    channel_id: { type: DataTypes.STRING(36), primaryKey: true },
    channel_name: { type: DataTypes.STRING(50), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    saver_id: { type: DataTypes.STRING(36), allowNull: false },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'saved_post_channels', timestamps: false });

const SavedExternalPosts = sequelize.define('saved_external_posts', {
    save_id: { type: DataTypes.STRING(36), primaryKey: true },
    post_id: { type: STRING(255), allowNull: false },
    saver_id: { type: STRING(36), allowNull: false },
    saved_channel_id: { type: STRING(36), allowNull: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, {
    tableName: 'saved_external_posts',
    timestamps: false,
    indexes: [
        { fields: ['post_id'] },
        { fields: ['saver_id'] },
        { fields: ['saved_channel_id'] },
        { unique: true, fields: ['post_id', 'saver_id', 'saved_channel_id'] }
    ]
});

export {
    DeepFeeds,
    DeepFeedContent,
    Feeds,
    FeedChannels,
    FeedChannelMessages,
    FeedChannelViews,
    Followers,
    ExternalFollows,
    FollowRequests,
    SavedPosts,
    SavedPostChannels,
    SavedExternalPosts
}