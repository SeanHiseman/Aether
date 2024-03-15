import { BOOLEAN, STRING, DATE, INTEGER, TEXT, NOW } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Profiles = sequelize.define('profiles', {
  profile_id: { type: STRING(36), primaryKey: true },
  user_id: { type: STRING(36), allowNull: false },
  profile_photo: { type: STRING(120) },
  bio: { type: STRING(1000) }
}, {tableName: 'profiles', timestamps: false });


const ProfileChannels = sequelize.define('profile_channels', { 
  channel_id: { type: STRING(36), primaryKey: true }, 
  channel_name: { type: STRING(100), allowNull: false }, 
  profile_id: { type: STRING(36), allowNull: false},
  is_posts: { type: BOOLEAN, defaultValue: true},
  date_created: { type: DATE, defaultValue: NOW },
}, {tableName: 'profile_channels', timestamps: false}); 

ProfileChannels.belongsTo(Profiles, { foreignKey: 'profile_id' }); 
Profiles.hasMany(ProfileChannels, { foreignKey: 'profile_id' }); 

const Users = sequelize.define('users', {
  user_id: { type: STRING(36), primaryKey: true },
  username: { type: STRING(120), allowNull: false },
  password: { type: STRING(120), allowNull: false },
  UserSince: { type: DATE, defaultValue: NOW }
}, {tableName: 'users', timestamps: false});

//Users relationships
Users.hasOne(Profiles, { foreignKey: 'user_id' });
Profiles.belongsTo(Users, { foreignKey: 'user_id' });


const ProfilePosts = sequelize.define('profile_posts', {
  post_id: { type: STRING(36), primaryKey: true },
  profile_id: { type: STRING(36), allowNull: false }, 
  channel_id: { type: String(36), allowNull: false},
  title: { type: STRING(120), allowNull: true },
  content: { type: TEXT, allowNull: false },
  comments: { type: INTEGER, allowNull: false, defaultValue: 0 },
  views: { type: INTEGER, allowNull: false, defaultValue: 0 },
  likes: { type: INTEGER, allowNull: false, defaultValue: 0 },
  dislikes: { type: INTEGER, allowNull: false, defaultValue: 0 },
  timestamp: { type: DATE, defaultValue: NOW },
  poster_id: { type: STRING(36), primaryKey: true },
}, {tableName: 'profile_posts', timestamps: false});

//Profile posts relationships
Users.hasMany(ProfilePosts, { as: 'ProfilePoster', foreignKey: 'poster_id' });
ProfilePosts.belongsTo(Users, {  as: 'ProfilePoster', foreignKey: 'poster_id' });
//Profiles can have many posts
Profiles.hasMany(ProfilePosts, { foreignKey: 'profile_id' });
ProfilePosts.belongsTo(Profiles, { foreignKey: 'profile_id', allowNull: true });


const ProfileComments = sequelize.define('profile_comments', {
  comment_id: { type: STRING(36), primaryKey: true },
  post_id: { type: STRING(36), allowNull: false },
  commenter_id: { type: STRING(36) },
  content: { type: STRING(1000), allowNull: false },
  likes: { type: INTEGER, allowNull: false },
  dislikes: { type: INTEGER, allowNull: false },
  timestamp: { type: DATE, defaultValue: NOW },
  parent_id: { type: STRING(36) }
}, {tableName: 'profile_comments', timestamps: false});

ProfilePosts.hasMany(ProfileComments, { as: 'ProfilePostComments', foreignKey: 'post_id' });
ProfileComments.belongsTo(ProfilePosts, { as: 'ProfilePost', foreignKey: 'post_id' });
Users.hasMany(ProfileComments, { as: 'UserProfileComments', foreignKey: 'commenter_id' });
ProfileComments.belongsTo(Users, { as: 'ProfileCommenter',foreignKey: 'commenter_id' });


const Groups = sequelize.define('groups', {
  group_id: { type: STRING(36), primaryKey: true },
  parent_id: { type: STRING(36), allowNull: true },
  group_name: { type: STRING(100), allowNull: false },
  description: { type: STRING(1000), allowNull: true },
  group_photo: { type: TEXT, allowNull: true },
  member_count: { type: INTEGER, defaultValue: 0 },
  date_created: { type: DATE, defaultValue: NOW },
  is_private: { type: BOOLEAN, defaultValue: false},
  group_leader: { type: STRING(36), allowNull: false},
}, { tableName: 'groups', timestamps: false });

const GroupPosts = sequelize.define('group_posts', {
  post_id: { type: STRING(36), primaryKey: true },
  group_id: { type: STRING(36), allowNull: false }, 
  channel_id: { type: String(36), allowNull: false},
  title: { type: STRING(120), allowNull: true },
  content: { type: TEXT, allowNull: false },
  comments: { type: INTEGER, allowNull: false, defaultValue: 0 },
  views: { type: INTEGER, allowNull: false, defaultValue: 0 },
  likes: { type: INTEGER, allowNull: false, defaultValue: 0 },
  dislikes: { type: INTEGER, allowNull: false, defaultValue: 0 },
  timestamp: { type: DATE, defaultValue: NOW },
  media_urls: { type: TEXT, allowNull: true},
  poster_id: { type: STRING(36), primaryKey: true },
}, {tableName: 'group_posts', timestamps: false});

//Group posts relationships
Users.hasMany(GroupPosts, { as: 'GroupPoster', foreignKey: 'poster_id' });
GroupPosts.belongsTo(Users, { as: 'GroupPoster', foreignKey: 'poster_id' });
//Groups can have many posts
Groups.hasMany(GroupPosts, { foreignKey: 'group_id' });
GroupPosts.belongsTo(Groups, { foreignKey: 'group_id', allowNull: true });


//Allows many-to-many relationship between users and groups
const UserGroups = sequelize.define('user_groups', {
  user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
  group_id: { type: STRING(36), primaryKey: true, references: { model: 'Groups', key: 'group_id'}},
  is_mod: { type: BOOLEAN, defaultValue: false },
  is_admin: { type: BOOLEAN, defaultValue: false },
}, { tableName: 'user_groups', timestamps: false });

//Groups relationships
Users.belongsToMany(Groups, { through: UserGroups, foreignKey: 'user_id', otherKey: 'group_id' });
Groups.belongsToMany(Users, { through: UserGroups, foreignKey: 'group_id', otherKey: 'user_id' });
UserGroups.belongsTo(Users, { foreignKey: 'user_id' });
UserGroups.belongsTo(Groups, { foreignKey: 'group_id' });
//Nested groups
Groups.belongsTo(Groups, { as: 'ParentGroup', foreignKey: 'parent_id' });
Groups.hasMany(Groups, { as: 'SubGroups', foreignKey: 'parent_id' });

const GroupChannels = sequelize.define('group_channels', { 
  channel_id: { type: STRING(36), primaryKey: true }, 
  channel_name: { type: STRING(100), allowNull: false }, 
  group_id: { type: STRING(36), allowNull: false }, 
  is_posts: { type: BOOLEAN, defaultValue: true},
  date_created: { type: DATE, defaultValue: NOW },
}, { tableName: 'group_channels', timestamps: false }); 

GroupChannels.belongsTo(Groups, { foreignKey: 'group_id' }); 
Groups.hasMany(GroupChannels, { foreignKey: 'group_id' }); 


const GroupChannelMessages = sequelize.define('group_channel_messages', { 
  message_id: { type: STRING(36), primaryKey: true }, 
  message_content: { type: STRING(1000), allowNull: false }, 
  group_id: { type: STRING(36), allowNull: false},
  channel_id: { type: STRING(36), allowNull: false }, 
  message_time: { type: DATE, defaultValue: NOW },
  sender_id: { type: STRING(36), allowNull: false}
}, { tableName: 'group_channel_messages', timestamps: false }); 

GroupChannelMessages.belongsTo(GroupChannels, { foreignKey: 'channel_id' }); 
GroupChannels.hasMany(GroupChannelMessages, { foreignKey: 'channel_id' });


const GroupComments = sequelize.define('group_comments', {
  comment_id: { type: STRING(36), primaryKey: true },
  post_id: { type: STRING(36), allowNull: false },
  commenter_id: { type: STRING(36) },
  content: { type: STRING(1000), allowNull: false },
  likes: { type: INTEGER, allowNull: false },
  dislikes: { type: INTEGER, allowNull: false },
  timestamp: { type: DATE, defaultValue: NOW },
  parent_id: { type: STRING(36) }
}, {tableName: 'group_comments', timestamps: false});

//Comments relationships
GroupPosts.hasMany(GroupComments, { as: 'GroupPostComments', foreignKey: 'post_id' });
GroupComments.belongsTo(GroupPosts, { as: 'GroupPost', foreignKey: 'post_id' });
Users.hasMany(GroupComments, { as: 'UserGroupComments', foreignKey: 'commenter_id' });
GroupComments.belongsTo(Users, { as: 'GroupCommenter',foreignKey: 'commenter_id' });


const ContentVotes = sequelize.define('content_votes', {
  vote_id: { type: STRING(36), primaryKey: true },
  content_id: { type: STRING(36), allowNull: false },
  user_id: { type: STRING(36), allowNull: false },
  vote_count: {type: INTEGER, defaultValue: 0},
});


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
  title: { type: STRING(256), allowNull: true},
  created_at: { type: DATE, defaultValue: NOW },
  updated_at: { type: DATE, defaultValue: NOW }
}, { tableName: 'conversations', timestamps: false });  


//Allows many-to-many relationship between users and conversations
const UserConversations = sequelize.define('user_conversations', {
  user_id: { type: STRING(36), primaryKey: true, references: { model: 'Users', key: 'user_id' }},
  conversation_id: { type: STRING(36), primaryKey: true, references: { model: 'Conversations', key: 'conversation_id' }}
}, { tableName: 'user_conversations', timestamps: false });

//Many to many relationship between Users and Conversations
Users.belongsToMany(Conversations, { through: UserConversations, foreignKey: 'user_id', otherKey: 'conversation_id', as: 'users' });
Conversations.belongsToMany(Users, { through: UserConversations, foreignKey: 'conversation_id', otherKey: 'user_id', as: 'users' });
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
    ProfileChannels,
    Users, 
    ProfilePosts,
    ProfileComments,
    Groups,
    GroupPosts,
    UserGroups,
    GroupChannels,
    GroupChannelMessages,
    GroupComments,
    ContentVotes,
    Friends,
    FriendRequests,
    UserConversations,
    Conversations,
    Messages,
}
  
