import { BOOLEAN, DataTypes, STRING, INTEGER, TEXT } from 'sequelize';
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
    nested_deep_feed_id: { type: STRING(36), allowNull: true } 
}, { tableName: 'deep_feed_content', timestamps: false });

const Feeds = sequelize.define('feeds', {
    feed_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true },
    feed_name: { type: STRING(100), allowNull: false },
    description: { type: STRING(1000), allowNull: true },
    feed_photo: { type: TEXT, allowNull: true },
    follower_count: { type: INTEGER, defaultValue: 0 },
    type: { type: STRING(10), defaultValue: 'public' },
    is_group: { type: BOOLEAN, defaultValue: false },
    feed_owner: { type: STRING(36), allowNull: false, references: { model: Users, key: 'user_id' } },
    is_locked: { type: BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'feeds', timestamps: false });

const FeedChannels = sequelize.define('feed_channels', { 
    channel_id: { type: STRING(36), primaryKey: true }, 
    channel_name: { type: STRING(100), allowNull: false },     
    description: { type: STRING(1000), allowNull: true },
    feed_id: { type: STRING(36), allowNull: false }, 
    is_posts: { type: BOOLEAN, defaultValue: true},
    is_chat: { type: BOOLEAN, defaultValue: true},
    display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'feed_channels', timestamps: false }); 

const FeedChannelMessages = sequelize.define('feed_channel_messages', { 
    message_id: { type: STRING(36), primaryKey: true }, 
    content: { type: STRING(1000), allowNull: false }, 
    channel_id: { type: STRING(36), allowNull: false }, 
    sender_id: { type: STRING(36), allowNull: false},
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'feed_channel_messages', timestamps: false }); 
  
const Followers = sequelize.define('followers', {
    follow_id: { type: STRING(36), primaryKey: true },
    follower_id: { type: STRING(36), allowNull: false },
    feed_id: { type: STRING(36), allowNull: false },
    is_mod: { type: BOOLEAN, defaultValue: false },
    is_admin: { type: BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'followers', timestamps: false });

const FollowRequests = sequelize.define('follow_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false},
    receiver_id: { type: STRING(36), allowNull: false},
    timestamp: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') }
}, { tableName: 'follow_requests', timestamps: false });

export {
    DeepFeeds,
    DeepFeedContent,
    Feeds, 
    FeedChannels,
    FeedChannelMessages,
    Followers,
    FollowRequests,
}