import { BOOLEAN, STRING, DATE, INTEGER, TEXT, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Feeds = sequelize.define('feeds', {
    feed_id: { type: STRING(36), primaryKey: true },
    parent_id: { type: STRING(36), allowNull: true },
    feed_name: { type: STRING(100), allowNull: false },
    description: { type: STRING(1000), allowNull: true },
    feed_photo: { type: TEXT, allowNull: true },
    follower_count: { type: INTEGER, defaultValue: 0 },
    date_created: { type: DATE, defaultValue: NOW },
    type: { type: STRING(10), defaultValue: 'public' },
    is_group: { type: BOOLEAN, defaultValue: false },
    feed_owner: { type: STRING(36), allowNull: false },
}, { tableName: 'feeds', timestamps: false });

const FeedChannels = sequelize.define('feed_channels', { 
    channel_id: { type: STRING(36), primaryKey: true }, 
    channel_name: { type: STRING(100), allowNull: false }, 
    feed_id: { type: STRING(36), allowNull: false }, 
    is_posts: { type: BOOLEAN, defaultValue: true},
    is_chat: { type: BOOLEAN, defaultValue: true},
    date_created: { type: DATE, defaultValue: NOW },
}, { tableName: 'feed_channels', timestamps: false }); 

const Followers = sequelize.define('followers', {
    follow_id: { type: STRING(36), primaryKey: true },
    follower_id: { type: STRING(36), allowNull: false },
    feed_id: { type: STRING(36), allowNull: false },
}, { tableName: 'followers', timestamps: false });

const FollowRequests = sequelize.define('follow_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false, references: { model: 'Feeds', key: 'feed_id' }},
    location_id: { type: STRING(36), allowNull: false, references: { model: 'Feeds', key: 'feed_id' }},
}, { tableName: 'follow_requests', timestamps: false });

const NestedFeeds = sequelize.define('nested_feeds', { //Many-to-many relationship between feeds
    sub_feed_id: { type: STRING(36), primaryKey: true, references: { model: 'Feeds', key: 'feed_id' }},
    parent_feed_id: { type: STRING(36), primaryKey: true, references: { model: 'Feeds', key: 'feed_id' }},
}, { tableName: 'nested_feed', timestamps: false });


export {
    Feeds, 
    FeedChannels,
    Followers,
    FollowRequests,
    NestedFeeds
}