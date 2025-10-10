import sequelize from '../databaseSetup.js';
import { Feeds, FeedChannels, Followers, Posts, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import { Op } from 'sequelize';
import fs from 'fs';

async function cleanupTestData() {
	try {
		await sequelize.transaction(async (t) => {
			const postsToDelete = await Posts.findAll({
				where: {
					[Op.or]: [
						{ post_id: { [Op.like]: '111111111111%' } },
						{ parent_id: { [Op.like]: '111111111111%' } }
					]
				},
				transaction: t
			});
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
			for (const post of postsToDelete) {
				const filePath = `.${post.content}`;
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
				} catch (err) {
					console.warn(`Failed to delete file ${filePath}:`, err.message);
				}
			}
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