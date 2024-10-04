import { Feeds, Followers } from '../../models/feeds.js';

async function checkIfFollowing(follower_id, feed_id) {
    const feed = await Feeds.findOne({ where: { feed_id }});
    if (!feed) {
        return false;
    }
    const following = await Followers.findOne({
        where: {
            follower_id,
            feed_id
        },
    });
    return !!following;
}

export default checkIfFollowing;