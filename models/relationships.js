import { Posts, PostNotes, PostVotes } from "./content";
import { Feeds, FeedChannels, Followers, FollowRequests, NestedFeeds, UserFeeds } from "./feeds";
import { AskChats, AskMessages, Chats, Messages, UserChats } from "./messages";
import { Connections, ConnectRequests, Users, UserFeeds } from "./users";

Users.hasMany(Feeds, { foreignKey: 'feed_owner' });
Feeds.belongsTo(Users, { foreignKey: 'feed_owner' });

Feeds.hasMany(FeedChannels, { foreignKey: 'feed_id' });
FeedChannels.belongsTo(Feeds, { foreignKey: 'feed_id' });

Feeds.belongsToMany(Users, { through: Followers, foreignKey: 'feed_id', otherKey: 'follower_id', as: 'followedFeed' });
Users.belongsToMany(Feeds, { through: Followers, foreignKey: 'follower_id', otherKey: 'feed_id', as: 'followingFeed' });
Followers.belongsTo(Feeds, { foreignKey: 'feed_id' });
Feeds.hasMany(Followers, { foreignKey: 'feed_id' });

Feeds.hasMany(Posts, { as: 'Poster', foreignKey: 'poster_id' });
Posts.belongsTo(Feeds, { as: 'Poster', foreignKey: 'poster_id' });
FeedChannels.hasMany(Posts, { as: 'ChildPost', foreignKey: 'feed_id' });

Posts.hasMany(Posts, { as: 'ParentPost', foreignKey: 'post_id' });
Posts.belongsTo(Posts, { as: 'Reply', foreignKey: 'post_id' });

Users.belongsToMany(Feeds, { through: UserFeeds, foreignKey: 'user_id', otherKey: 'feed_id' });
Feeds.belongsToMany(Users, { through: UserFeeds, foreignKey: 'feed_id', otherKey: 'user_id' });
UserFeeds.belongsTo(Users, { foreignKey: 'user_id' });
UserFeeds.belongsTo(Feeds, { foreignKey: 'feed_id' }); 
Feeds.hasMany(UserFeeds, { foreignKey: 'feed_id' });

Feeds.hasMany(NestedFeeds, { as: 'Parent', foreignKey: 'parent_feed_id' });
Feeds.hasMany(NestedFeeds, { as: 'Sub', foreignKey: 'sub_feed_id' });
NestedFeeds.belongsTo(Feeds, { as: 'Parent', foreignKey: 'parent_feed_id' });
NestedFeeds.belongsTo(Feeds, { as: 'Sub', foreignKey: 'sub_feed_id' });

Feeds.hasMany(FollowRequests, { as: 'Receiver', foreignKey: 'feed_id' });
FollowRequests.belongsTo(Feeds, { as: 'Sender', foreignKey: 'sender_id' });

Feeds.hasMany(PostVotes, { as: 'PostVotes', foreignKey: 'feed_id' });
Posts.hasMany(PostVotes, { as: 'PostVotes', foreignKey: 'post_id' });
PostVotes.belongsTo(Posts, { as: 'Post', foreignKey: 'post_id', constraints: false });

Users.belongsToMany(Users, { as: 'Connections', through: Connections, foreignKey: 'user1_id', otherKey: 'user2_id' });
Feeds.hasMany(ConnectRequests, { as: 'SentRequests', foreignKey: 'sender_id' });
Feeds.hasMany(ConnectRequests, { as: 'ReceivedRequests', foreignKey: 'receiver_id' });
ConnectRequests.belongsTo(Users, { as: 'sender', foreignKey: 'sender_id' });
ConnectRequests.belongsTo(Users, { as: 'receiver', foreignKey: 'receiver_id' });

Users.belongsToMany(Chats, { through: UserChats, foreignKey: 'user_id', otherKey: 'chat_id', as: 'users' });
Chats.belongsToMany(Users, { through: UserChats, foreignKey: 'chat_id', otherKey: 'user_id', as: 'users' });
UserChats.belongsTo(Chats, { foreignKey: 'chat_id'});
Chats.hasMany(UserChats, { foreignKey: 'chat_id'});

Chats.hasMany(Messages, { foreignKey: 'chat_id' });
Messages.belongsTo(Chats, { foreignKey: 'chat_id' });
Users.hasMany(Messages, { foreignKey: 'sender_id' });
Messages.belongsTo(Users, { foreignKey: 'sender_id' });

AskChats.belongsTo(Users, { foreignKey: 'user_id', as: 'user' });
Users.belongsTo(AskChats, { foreignKey: 'user_id', as: 'askChats' });

AskChats.hasMany(AskMessages, { foreignKey: 'chat_id', as: 'messages' });
AskMessages.belongsTo(AskChats, { foreignKey: 'chat_id', as: 'chat' });
Users.hasMany(AskMessages, { foreignKey: 'sender_id', as: 'sentMessages' });
AskMessages.belongsTo(Users, { foreignKey: 'sender_id', as: 'sender' });

PostNotes.belongsTo(Posts, { foreignKey: 'post_id', as: 'parentPost'});
Posts.hasOne(PostNotes, { foreignKey: 'post_id', as: 'note'});