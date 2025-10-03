import sequelize from '../databaseSetup.js';
import { Feeds, FeedChannels, Followers, Posts, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import { Op } from 'sequelize';

async function cleanupTestData() {
	try {
        await sequelize.transaction(async (t) => {
            await PostVotes.destroy({
                where: { post_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await SavedPosts.destroy({
                where: { post_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await ViewedPosts.destroy({
                where: { post_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await Posts.destroy({
                where: {
                    [Op.or]: [
                        { post_id: { [Op.like]: '111111111111%' } },
                        { parent_id: { [Op.like]: '111111111111%' } }
                    ]
                },
                transaction: t
            });
            await FeedChannels.destroy({
                where: { channel_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await Followers.destroy({
                where: { feed_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await Feeds.destroy({
                where: { feed_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
            await Users.destroy({
                where: { user_id: { [Op.like]: '111111111111%' } },
                transaction: t
            });
        });
		console.log('Test data removed successfully.');
	} catch (error) {
		console.error('Error cleaning up test data:', error);
	}
}

cleanupTestData();