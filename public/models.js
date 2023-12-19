import { Sequelize, STRING, DATE, INTEGER, TEXT, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Profiles = sequelize.define('profiles', {
  profile_id: { type: STRING(36), primaryKey: true },
  user_id: { type: STRING(36), allowNull: false },
  profile_photo: { type: STRING(120) },
  bio: { type: STRING(1000) }
}, {tableName: 'profiles', timestamps: false });


const Users = sequelize.define('users', {
    user_id: { type: STRING(36), primaryKey: true },
    username: { type: STRING(120), allowNull: false },
    password: { type: STRING(120), allowNull: false },
    UserSince: { type: DATE, defaultValue: NOW }
  }, {tableName: 'users', timestamps: false});

//Users relationships
Users.hasOne(Profiles, { foreignKey: 'user_id' });
Profiles.belongsTo(Users, { foreignKey: 'user_id' });


const Posts = sequelize.define('posts', {
    post_id: { type: STRING(36), primaryKey: true },
    //profile_id: { type: STRING(36), allowNull: true}, //if posted to own profile
    //group_id: { type: STRING(36), allowNull: true }, //if posted to group
    title: { type: STRING(120), allowNull: false },
    path: { type: STRING(120), allowNull: false },
    content_type: { type: STRING(50), allowNull: false },
    duration: { type: INTEGER },
    size: { type: INTEGER, allowNull: false },
    comments: { type: INTEGER, allowNull: false },
    views: { type: INTEGER, allowNull: false },
    likes: { type: INTEGER, allowNull: false },
    dislikes: { type: INTEGER, allowNull: false },
    timestamp: { type: DATE, defaultValue: NOW },
    poster_id: { type: STRING(36), primaryKey: true },
  }, {tableName: 'posts', timestamps: false});

//Posts relationships
Users.hasMany(Posts, { foreignKey: 'poster_id' });
Posts.belongsTo(Users, { foreignKey: 'poster_id' });


const Groups = sequelize.define('groups', {
  group_id: { type: STRING(36), primaryKey: true},
  parent_id: { type: STRING(36), allowNull: true },
  name: { type: STRING(100), allowNull: false},
  description: { type: TEXT, allowNull: true},
  follower_count: { type: INTEGER, defaultValue: 0},
}, { tableName: 'groups', timestamps: false });


//Allows many-to-many relationship between users and groups
const UserGroups = sequelize.define('user_groups', {
  user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
  group_id: { type: STRING(36), primaryKey: true, references: { model: 'Groups', key: 'group_id'}}
}, { tableName: 'user_groups', timestamps: false });

//Groups relationships
Users.belongsToMany(Groups, { through: UserGroups, foreignKey: 'user_id' });
Groups.belongsToMany(Users, { through: UserGroups, foreignKey: 'group_id' });
//Nested groups
Groups.belongsTo(Groups, { as: 'ParentGroup', foreignKey: 'parent_id' });
Groups.hasMany(Groups, { as: 'SubGroups', foreignKey: 'parent_id' });


const Channels = sequelize.define('channels', { 
  channel_id: { type: STRING(36), primaryKey: true}, 
  channel_name: { type: STRING(100), allowNull: false}, 
  group_id: { type: STRING(36), allowNull: false}, 
}); 

Channels.belongsTo(Groups, { foreignKey: 'group_id' }); 
Groups.hasMany(Channels, { foreignKey: 'group_id' }); 


const ChannelMessages = sequelize.define('channel_messages', { 
  message_id: { type: STRING(36), primaryKey: true }, 
  message_content: { type: STRING(1000), allowNull: false}, 
  channel_id: { type: STRING(36), allowNull: false}, 
}); 

ChannelMessages.belongsTo(Channels, { foreignKey: 'channel_id' }); 
Channels.hasMany(ChannelMessages, { foreignKey: 'channel_id' });


const Comments = sequelize.define('comments', {
  comment_id: { type: STRING(36), primaryKey: true },
  post_id: { type: STRING(36), allowNull: false },
  commenter_id: { type: STRING(36) },
  comment_text: { type: STRING(1000), allowNull: false },
  likes: { type: INTEGER, allowNull: false },
  dislikes: { type: INTEGER, allowNull: false },
  timestamp: { type: DATE, defaultValue: NOW },
  parent_id: { type: STRING(36) }
}, {tableName: 'comments', timestamps: false});

//Comments relationships
Posts.hasMany(Comments, { as: 'PostComments', foreignKey: 'post_id' });
Comments.belongsTo(Posts, { as: 'Post', foreignKey: 'post_id' });
Users.hasMany(Comments, { as: 'UserComments', foreignKey: 'commenter_id' });
Comments.belongsTo(Users, {  as: 'Commenter',foreignKey: 'commenter_id' });


const Friends = sequelize.define('friends', {
    friendship_id: { type: STRING(36), primaryKey: true },
    user1_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    user2_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    FriendSince: { type: DATE, allowNull: false, defaultValue: NOW }
  }, { tableName: 'friends', timestamps: false });
Users.belongsToMany(Users, { as: 'UserFriends', through: Friends, foreignKey: 'user1_id', otherKey: 'user2_id' });

const FriendRequests = sequelize.define('friend_requests', {
    request_id: { type: STRING(36), primaryKey: true },
    sender_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
    receiver_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }}
  }, { tableName: 'friend_requests', timestamps: false });

// FriendRequest relationships
Users.hasMany(FriendRequests, { as: 'sent_requests', foreignKey: 'sender_id' });
Users.hasMany(FriendRequests, { as: 'received_requests', foreignKey: 'receiver_id' });
FriendRequests.belongsTo(Users, { as: 'sender', foreignKey: 'sender_id' });
FriendRequests.belongsTo(Users, { as: 'receiver', foreignKey: 'receiver_id' });


const Conversations = sequelize.define('conversations', {
  conversation_id: { type: STRING(36), primaryKey: true },
  created_at: { type: DATE, defaultValue: NOW },
  updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'conversations', timestamps: false });  


//Allows many-to-many relationship between users and conversations
const UserConversations = sequelize.define('user_conversations', {
  user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
  conversation_id: { type: STRING(36), primaryKey: true, references: { model: 'Conversations', key: 'conversation_id' }}
}, { tableName: 'user_conversations', timestamps: false });

//Many to many relationship between Users and Conversations
Users.belongsToMany(Conversations, { through: UserConversations, foreignKey: 'user_id' });
Conversations.belongsToMany(Users, { through: UserConversations, foreignKey: 'conversation_id' });
//Direct association between UserConversations and Conversations
UserConversations.belongsTo(Conversations, { foreignKey: 'conversation_id'});
Conversations.hasMany(UserConversations, { foreignKey: 'conversation_id'});

const Messages = sequelize.define('messages', {
  message_id: { type: STRING(36), primaryKey: true },
  conversation_id: { type: STRING(36), allowNull: false, references: { model: 'Conversations', key: 'conversation_id' }},
  sender_id: { type: STRING(36), allowNull: false, references: { model: 'Users', key: 'user_id' }},
  message_content: { type: STRING(1000), allowNull: false },
  timestamp: { type: DATE, defaultValue: NOW }
}, { tableName: 'messages', timestamps: false });

//Messages relationships
Conversations.hasMany(Messages, { foreignKey: 'conversation_id' });
Messages.belongsTo(Conversations, { foreignKey: 'conversation_id' });
Users.hasMany(Messages, { foreignKey: 'sender_id' });
Messages.belongsTo(Users, { foreignKey: 'sender_id' });

export {
    Profiles,
    Users, 
    Posts,
    Groups,
    UserGroups,
    Channels,
    ChannelMessages,
    Comments,
    Friends,
    FriendRequests,
    UserConversations,
    Conversations,
    Messages,
}
  
