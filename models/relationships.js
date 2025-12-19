import { AppBuilds, Posts, PostDrafts, PostNotes, PostVotes, Prompts, ViewedPosts } from "./content.js";
import { DeepFeeds, DeepFeedContent, Feeds, FeedChannels, FeedChannelMessages, Followers, FollowRequests, SavedPosts, SavedPostChannels } from "./feeds.js";
import { AskChats, AskMessages, Chats, ConnectRequests, Connections, FeedChats, Messages } from "./messages.js";
import { Feedback, Users } from "./users.js";

Users.hasMany(Feeds, { foreignKey: 'feed_owner' });
Feeds.belongsTo(Users, { foreignKey: 'feed_owner' });

Users.hasMany(Feedback, { foreignKey: 'user_id' });
Feedback.belongsTo(Users, { foreignKey: 'user_id' });

Feeds.hasMany(FeedChannels, { foreignKey: 'feed_id', as: 'channels', onDelete: 'CASCADE' });
FeedChannels.belongsTo(Feeds, { foreignKey: 'feed_id' });

DeepFeeds.hasMany(DeepFeeds, { foreignKey: 'parent_id', as: 'children' });
DeepFeeds.hasMany(DeepFeedContent, { foreignKey: 'deep_feed_id', as: 'contents' });

DeepFeedContent.belongsTo(Feeds, { foreignKey: "feed_id", as: "feed" });

FeedChannelMessages.belongsTo(FeedChannels, { foreignKey: 'channel_id' }); 
FeedChannels.hasMany(FeedChannelMessages, { foreignKey: 'channel_id' });
FeedChannelMessages.belongsTo(Feeds, { foreignKey: 'sender_id' });
Feeds.hasMany(FeedChannelMessages, { foreignKey: 'sender_id' });

Feeds.belongsToMany(Feeds, { through: Followers, foreignKey: 'feed_id', otherKey: 'follower_id', as: 'feedFollowers', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Feeds.belongsToMany(Feeds, { through: Followers, foreignKey: 'follower_id', otherKey: 'feed_id', as: 'followingFeeds', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Followers.belongsTo(Feeds, { foreignKey: 'feed_id', as: 'followedFeed', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Followers.belongsTo(Feeds, { foreignKey: 'follower_id', as: 'followerFeed', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Feeds.hasMany(Followers, { foreignKey: 'feed_id', as: 'followersList', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Feeds.hasMany(Followers, { foreignKey: 'follower_id', as: 'followingList', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

Feeds.hasMany(Posts, { as: 'poster', foreignKey: 'poster_id', onDelete: 'CASCADE' });
Posts.belongsTo(Feeds, { as: 'poster', foreignKey: 'poster_id', targetKey: 'feed_id' });
Posts.belongsTo(FeedChannels, { as: 'parentChannel', foreignKey: 'channel_id' });
FeedChannels.hasMany(Posts, { as: 'posts', foreignKey: 'channel_id' });

Posts.hasMany(Posts, { as: 'childPosts', foreignKey: 'parent_id', onDelete: 'CASCADE' });
Posts.belongsTo(Posts, { as: 'parentPost', foreignKey: 'parent_id' });

ViewedPosts.belongsTo(Posts, { foreignKey: 'post_id' });
Posts.hasMany(ViewedPosts, { foreignKey: 'post_id', onDelete: 'CASCADE' });

ViewedPosts.belongsTo(Feeds, { foreignKey: 'viewer_id', as: 'viewer' });
Feeds.hasMany(ViewedPosts, { foreignKey: 'viewer_id', as: 'viewedPosts' });

Posts.hasMany(AppBuilds, { foreignKey: 'post_id', sourceKey: 'post_id' });
AppBuilds.belongsTo(Posts, { foreignKey: 'post_id', targetKey: 'post_id' });

Feeds.hasMany(FollowRequests, { as: 'receivedFollowRequests', foreignKey: 'receiver_id' });
FollowRequests.belongsTo(Feeds, { as: 'sender', foreignKey: 'sender_id' });
FollowRequests.belongsTo(Feeds, { as: 'receiver', foreignKey: 'receiver_id' });

Posts.hasMany(PostVotes, { as: 'votes', foreignKey: 'post_id', onDelete: 'CASCADE' });
PostVotes.belongsTo(Posts, { as: 'parentPost', foreignKey: 'post_id' });

Feeds.belongsToMany(Feeds, { as: 'feedConnections', through: Connections, foreignKey: 'feed1_id', otherKey: 'feed2_id' });
Feeds.hasMany(ConnectRequests, { as: 'sentRequests', foreignKey: 'sender_id' });
Feeds.hasMany(ConnectRequests, { as: 'receivedConnectRequests', foreignKey: 'receiver_id' });
ConnectRequests.belongsTo(Feeds, { as: 'sender', foreignKey: 'sender_id' });
ConnectRequests.belongsTo(Feeds, { as: 'receiver', foreignKey: 'receiver_id' });

Chats.belongsToMany(Feeds, { through: FeedChats, foreignKey: 'chat_id',  as: 'feeds' });
Feeds.belongsToMany(Chats, { through: FeedChats, foreignKey: 'feed_id',  as: 'chats' });
Chats.hasMany(FeedChats, { foreignKey: 'chat_id' });
FeedChats.belongsTo(Chats, { foreignKey: 'chat_id' });

Feeds.hasMany(Connections, { foreignKey: 'feed1_id', as: 'ConnectionsAsFeed1' });
Feeds.hasMany(Connections, { foreignKey: 'feed2_id', as: 'ConnectionsAsFeed2' });
Connections.belongsTo(Feeds, { foreignKey: 'feed1_id', as: 'Feed1' });
Connections.belongsTo(Feeds, { foreignKey: 'feed2_id', as: 'Feed2' });

Chats.hasMany(Messages, { foreignKey: 'chat_id' });
Messages.belongsTo(Chats, { foreignKey: 'chat_id' });
Feeds.hasMany(Messages, { foreignKey: 'sender_id' });
Messages.belongsTo(Feeds, { foreignKey: 'sender_id' });

AskChats.belongsTo(Users, { as: 'user', foreignKey: 'user_id' });
Users.hasMany(AskChats, { as: 'askChats', foreignKey: 'user_id' });

AskChats.hasMany(AskMessages, { foreignKey: 'chat_id', as: 'messages' });
AskMessages.belongsTo(AskChats, { foreignKey: 'chat_id', as: 'chat' });
Users.hasMany(AskMessages, { foreignKey: 'sender_id', as: 'sentMessages' });
AskMessages.belongsTo(Users, { foreignKey: 'sender_id', as: 'sender' });

PostNotes.belongsTo(Posts, { foreignKey: 'post_id', as: 'parentPost' });
Posts.hasOne(PostNotes, { foreignKey: 'post_id', as: 'note', onDelete: 'CASCADE' });

SavedPosts.belongsTo(Posts, { foreignKey: 'post_id' });
SavedPosts.belongsTo(Feeds,	{ foreignKey: 'feed_id' });
SavedPosts.belongsTo(SavedPostChannels, { foreignKey: 'channel_id' });
SavedPostChannels.belongsTo(Feeds, { foreignKey: 'saver_id' });
SavedPostChannels.hasMany(SavedPosts, { foreignKey: 'channel_id' });

PostDrafts.belongsTo(FeedChannels, { as: 'parentChannel', foreignKey: 'channel_id' });
FeedChannels.hasMany(PostDrafts, { as: 'drafts', foreignKey: 'channel_id' });

PostDrafts.belongsTo(Feeds, { as: 'feed', foreignKey: 'feed_id' });
Feeds.hasMany(PostDrafts, { as: 'drafts', foreignKey: 'feed_id' });

export {
    AppBuilds,
    AskChats, 
    AskMessages, 
    Chats, 
    ConnectRequests, 
    Connections, 
    DeepFeeds, 
    DeepFeedContent,
    Feedback,
    FeedChats, 
    Feeds, 
    FeedChannels, 
    FeedChannelMessages, 
    Followers, 
    FollowRequests, 
    Messages,
    Posts, 
    PostDrafts,
    PostNotes, 
    PostVotes,
    Prompts,
    SavedPosts,
    SavedPostChannels,
    Users,
    ViewedPosts
}