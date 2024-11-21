import { Posts, PostNotes, PostVotes } from "./content.js";
import { Feeds, FeedChannels, FeedChannelMessages, Followers, FollowRequests, NestedFeeds } from "./feeds.js";
import { AskChats, AskMessages, Chats, ConnectRequests, Connections, FeedChats, Messages } from "./messages.js";
import { Users } from "./users.js";

Users.hasMany(Feeds, { foreignKey: 'feed_owner' });
Feeds.belongsTo(Users, { foreignKey: 'feed_owner' });

Feeds.hasMany(FeedChannels, { foreignKey: 'feed_id', as: 'channels' });
FeedChannels.belongsTo(Feeds, { foreignKey: 'feed_id' });

FeedChannelMessages.belongsTo(FeedChannels, { foreignKey: 'channel_id' }); 
FeedChannels.hasMany(FeedChannelMessages, { foreignKey: 'channel_id' });
FeedChannelMessages.belongsTo(Feeds, { foreignKey: 'sender_id' });
Feeds.hasMany(FeedChannelMessages, { foreignKey: 'sender_id' });

Feeds.belongsToMany(Feeds, { through: Followers, foreignKey: 'feed_id', otherKey: 'follower_id', as: 'feedFollowers' });
Feeds.belongsToMany(Feeds, { through: Followers, foreignKey: 'follower_id', otherKey: 'feed_id', as: 'followingFeeds' });
Followers.belongsTo(Feeds, { foreignKey: 'feed_id', as: 'followedFeed' });
Followers.belongsTo(Feeds, { foreignKey: 'follower_id', as: 'followerFeed' });
Feeds.hasMany(Followers, { foreignKey: 'feed_id', as: 'followersList' });

Feeds.hasMany(Posts, { as: 'poster', foreignKey: 'poster_id' });
Posts.belongsTo(Feeds, { as: 'poster', foreignKey: 'poster_id' });
FeedChannels.hasMany(Posts, { as: 'childPost', foreignKey: 'feed_id' });

Posts.hasMany(Posts, { as: 'parentPost', foreignKey: 'post_id' });
Posts.belongsTo(Posts, { as: 'reply', foreignKey: 'post_id' });

Feeds.hasMany(NestedFeeds, { as: 'parentFeeds', foreignKey: 'parent_feed_id' });
Feeds.hasMany(NestedFeeds, { as: 'subFeeds', foreignKey: 'sub_feed_id' });
NestedFeeds.belongsTo(Feeds, { as: 'parentFeed', foreignKey: 'parent_feed_id' });
NestedFeeds.belongsTo(Feeds, { as: 'subFeed', foreignKey: 'sub_feed_id' });

Feeds.hasMany(FollowRequests, { as: 'receivedFollowRequests', foreignKey: 'receiver_id' });
FollowRequests.belongsTo(Feeds, { as: 'sender', foreignKey: 'sender_id' });
FollowRequests.belongsTo(Feeds, { as: 'receiver', foreignKey: 'receiver_id' });

Feeds.hasMany(PostVotes, { as: 'postVotes', foreignKey: 'feed_id' });
Posts.hasMany(PostVotes, { as: 'postVotes', foreignKey: 'post_id' });
PostVotes.belongsTo(Posts, { as: 'post', foreignKey: 'post_id', constraints: false });

Feeds.belongsToMany(Feeds, { as: 'feedConnections', through: Connections, foreignKey: 'feed1_id', otherKey: 'feed2_id' });
Feeds.hasMany(ConnectRequests, { as: 'sentRequests', foreignKey: 'sender_id' });
Feeds.hasMany(ConnectRequests, { as: 'receivedConnectRequests', foreignKey: 'receiver_id' });
ConnectRequests.belongsTo(Feeds, { as: 'sender', foreignKey: 'sender_id' });
ConnectRequests.belongsTo(Feeds, { as: 'receiver', foreignKey: 'receiver_id' });

Feeds.belongsToMany(Chats, { through: FeedChats, foreignKey: 'feed_id', otherKey: 'chat_id', as: 'chats' });
Chats.belongsToMany(Feeds, { through: FeedChats, foreignKey: 'chat_id', otherKey: 'feed_id', as: 'feeds' });
FeedChats.belongsTo(Chats, { foreignKey: 'chat_id' });
Chats.hasMany(FeedChats, { foreignKey: 'chat_id' });

Feeds.hasMany(Connections, { foreignKey: 'feed1_id', as: 'ConnectionsAsFeed1' });
Feeds.hasMany(Connections, { foreignKey: 'feed2_id', as: 'ConnectionsAsFeed2' });
Connections.belongsTo(Feeds, { foreignKey: 'feed1_id', as: 'Feed1' });
Connections.belongsTo(Feeds, { foreignKey: 'feed2_id', as: 'Feed2' });


Chats.hasMany(Messages, { foreignKey: 'chat_id' });
Messages.belongsTo(Chats, { foreignKey: 'chat_id' });
Feeds.hasMany(Messages, { foreignKey: 'sender_id' });
Messages.belongsTo(Feeds, { foreignKey: 'sender_id' });

AskChats.belongsTo(Feeds, { foreignKey: 'feed_id', as: 'feed' });
Feeds.belongsTo(AskChats, { foreignKey: 'feed_id', as: 'askChats' });

AskChats.hasMany(AskMessages, { foreignKey: 'chat_id', as: 'messages' });
AskMessages.belongsTo(AskChats, { foreignKey: 'chat_id', as: 'chat' });
Feeds.hasMany(AskMessages, { foreignKey: 'sender_id', as: 'sentMessages' });
AskMessages.belongsTo(Feeds, { foreignKey: 'sender_id', as: 'sender' });

PostNotes.belongsTo(Posts, { foreignKey: 'post_id', as: 'parentPost'});
Posts.hasOne(PostNotes, { foreignKey: 'post_id', as: 'note'});

export {
    AskChats, 
    AskMessages, 
    Chats, 
    ConnectRequests, 
    Connections, 
    FeedChats, 
    Feeds, 
    FeedChannels, 
    FeedChannelMessages, 
    Followers, 
    FollowRequests, 
    Messages,
    NestedFeeds,
    Posts, 
    PostNotes, 
    PostVotes,
    Users
}