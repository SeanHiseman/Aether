import { STRING, DATE, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';
import { Feeds } from './feeds.js'

const AskChats = sequelize.define('ask_chats', {
    chat_id: { type: STRING(36), primaryKey: true },
    name: { type: STRING(256), allowNull: true, defaultValue: 'New chat'},
    user_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    created_at: { type: DATE, defaultValue: NOW },
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'ask_chats', timestamps: false });  

const AskMessages = sequelize.define('ask_messages', {
    message_id: { type: STRING(36), primaryKey: true },
    chat_id: { type: STRING(36), allowNull: false, references: { model: AskChats, key: 'chat_id' }},
    sender_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    message_content: { type: STRING(1000), allowNull: false },
    timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'ask_messages', timestamps: false });

const Chats = sequelize.define('chats', {
    chat_id: { type: STRING(36), primaryKey: true },
    title: { type: STRING(256), allowNull: false, defaultValue: "New chat"},
    created_at: { type: DATE, defaultValue: NOW },
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'chats', timestamps: false });  

const Connections = sequelize.define('connections', {
    connection_id: { type: STRING(36), primaryKey: true },
    feed1_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    feed2_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    connection_date: { type: DATE, allowNull: false, defaultValue: NOW },
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'connections', timestamps: false });
   
const ConnectRequests = sequelize.define('connect_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    receiver_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'connect_requests', timestamps: false });

const FeedChats = sequelize.define('feed_chats', {
    feed_id: { type: STRING(36), primaryKey: true, references: { model: Feeds, key: 'feed_id' }},
    chat_id: { type: STRING(36), primaryKey: true, references: { model: Chats, key: 'chat_id' }},
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'feed_chats', timestamps: false });

const Messages = sequelize.define('messages', {
    message_id: { type: STRING(36), primaryKey: true },
    chat_id: { type: STRING(36), allowNull: false, references: { model: Chats, key: 'chat_id' }},
    sender_id: { type: STRING(36), allowNull: false, references: { model: Feeds, key: 'feed_id' }},
    content: { type: STRING(1000), allowNull: false },
    timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'messages', timestamps: false });
  
export {
    AskChats,
    AskMessages,
    Chats,
    Connections, 
    ConnectRequests,
    FeedChats,
    Messages,
}