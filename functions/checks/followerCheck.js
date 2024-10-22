import { Feeds, Followers } from '../../models/feeds.js';

async function checkIfFollowing(follower_id, feed_name) {
    try {
        const feed = await Feeds.findOne({ where: { feed_name }});
        if (!feed) {
            return false;
        }
        console.log("feed.feed_id:", feed.feed_id);
        const following = await Followers.findOne({
            where: {
                follower_id,
                feed_id: feed.feed_id
            },
        });
        console.log("following:", following);
        return !!following;
    } catch {
        return { following: false };
    }
}

export default checkIfFollowing;