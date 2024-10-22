import { Feeds, Followers } from '../../models/feeds.js';

async function checkIfAdminOrMod(follower_id, feed_name) {
    try {
        const feed = await Feeds.findOne({
            where: { feed_name }
        });
        if (!feed) {
            return false;
        }
        const feed_id = feed.feed_id;
        const following = await Followers.findOne({
            where: {
                follower_id,
                feed_id
            }
        });
        return { isAdmin: following.is_admin, isMod: following.is_mod };
    } catch (error) {
        return { isAdmin: false, isMod: false };
    }
}

export default checkIfAdminOrMod;