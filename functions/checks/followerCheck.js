import { Feeds, Followers } from '../../models/feeds.js';

async function checkIfFollowing(follower_id, feed_name) {
    try {
        const feed = await Feeds.findOne({ where: { feed_name }});
        if (!feed) {
            return false;
        }
        const following = await Followers.findOne({
            where: {
                follower_id,
                feed_id: feed.feed_id
            },
        });
        return !!following;
    } catch {
        return { following: false };
    }
}

export default checkIfFollowing;