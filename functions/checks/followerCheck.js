import { Followers } from '../../models/feeds.js';

async function FollowerCheck(follower_id, feed_id) {
    try {
        const following = await Followers.findOne({
            where: {
                follower_id,
                feed_id
            }
        });
        return {
            following: !!following,
            isAdmin: following?.is_admin || false,
            isMod: following?.is_mod || false
        };
    } catch (error) {
        return { following: false, isAdmin: false, isMod: false };
    }
}

export default FollowerCheck;