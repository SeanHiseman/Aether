import { BOOLEAN, FLOAT, STRING, DATE, INTEGER, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Connections = sequelize.define('connections', {
    connection_id: { type: STRING(36), primaryKey: true },
    user1_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    user2_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    connection_date: { type: DATE, allowNull: false, defaultValue: NOW }
}, { tableName: 'connections', timestamps: false });
   
const ConnectRequests = sequelize.define('connect_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    receiver_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }}
}, { tableName: 'connect_requests', timestamps: false });

const Users = sequelize.define('users', {
    user_id: { type: STRING(36), primaryKey: true },
    username: { type: STRING(120), allowNull: false },
    password: { type: STRING(120), allowNull: false },
    user_since: { type: DATE, defaultValue: NOW },
    collaborative_preference: { type: FLOAT, allowNull: false, defaultValue: 0.5 },
    time_preference: { type: FLOAT, allowNull: false, defaultValue: 0.0001 },
    has_membership: { type: BOOLEAN, defaultValue: false }, 
    theme: { type: STRING(120), allowNull: true },
    points: { type: INTEGER, allowNull: false, defaultValue: 0 }, 
}, { tableName: 'users', timestamps: false });

const UserFeeds = sequelize.define('user_feeds', { //Many-to-many relationship between users and feeds
    user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
    feed_id: { type: STRING(36), primaryKey: true, references: { model: 'Feeds', key: 'feed_id'}},
    is_mod: { type: BOOLEAN, defaultValue: false },
    is_admin: { type: BOOLEAN, defaultValue: false },
}, { tableName: 'user_feeds', timestamps: false });

export {
    Connections,
    ConnectRequests,
    Users,
    UserFeeds
}