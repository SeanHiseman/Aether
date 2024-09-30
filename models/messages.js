import { STRING, DATE, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';

const AskChats = sequelize.define('ask_chats', {
    chat_id: { type: STRING(36), primaryKey: true },
    name: { type: STRING(256), allowNull: true, defaultValue: 'New chat'},
    user_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    created_at: { type: DATE, defaultValue: NOW },
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'ask_chats', timestamps: false });  

const AskMessages = sequelize.define('ask_messages', {
    message_id: { type: STRING(36), primaryKey: true },
    chat_id: { type: STRING(36), allowNull: false, references: { model: 'AskChats', key: 'chat_id' }},
    sender_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    message_content: { type: STRING(1000), allowNull: false },
    timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'ask_messages', timestamps: false });

const Chats = sequelize.define('chats', {
    chat_id: { type: STRING(36), primaryKey: true },
    title: { type: STRING(256), allowNull: false, defaultValue: "New chat"},
    created_at: { type: DATE, defaultValue: NOW },
    updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'chats', timestamps: false });  

const Messages = sequelize.define('messages', {
    message_id: { type: STRING(36), primaryKey: true },
    chat_id: { type: STRING(36), allowNull: false, references: { model: 'Chats', key: 'chat_id' }},
    sender_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    message_content: { type: STRING(1000), allowNull: false },
    timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'messages', timestamps: false });
  
const UserChats = sequelize.define('user_chats', {
    user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
    chat_id: { type: STRING(36), primaryKey: true, references: { model: 'Chats', key: 'chat_id' }}
}, { tableName: 'user_chats', timestamps: false });

export {
    AskChats,
    AskMessages,
    Chats,
    Messages,
    UserChats
}