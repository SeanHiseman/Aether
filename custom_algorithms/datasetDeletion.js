import sequelize from '../databaseSetup.js';
import { Feeds, FeedChannels, Followers, Posts, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import { Op } from 'sequelize';
import fs from 'fs/promises';

const BATCH_SIZE = 500; // adjust based on your DB capacity
const likePattern = '111111111111%';

async function deleteInBatches(model, whereClause, transaction = null, modelName = '') {
	let deleted;
	let batchCount = 0;
	do {
		deleted = await model.destroy({
			where: whereClause,
			limit: BATCH_SIZE,
			transaction
		});
		batchCount++;
		if (deleted > 0) console.log(`Deleted batch ${batchCount} of ${deleted} ${modelName}`);
	} while (deleted > 0);
	if (batchCount === 0) console.log(`No ${modelName} records found to delete.`);
}

async function cleanupTestData() {
	try {
		console.log('Fetching posts to delete files...');
		const postsToDelete = await Posts.findAll({
			attributes: ['content'],
			where: { post_id: { [Op.like]: likePattern } }
		});
		console.log(`Found ${postsToDelete.length} posts to delete files.`);

		// Step 2: Delete files sequentially with logs
		for (const [index, post] of postsToDelete.entries()) {
			const filePath = `.${post.content}`;
			try {
				await fs.unlink(filePath);
				console.log(`Deleted file ${index + 1}/${postsToDelete.length}: ${filePath}`);
			} catch (err) {
				console.log(`File not found or error deleting: ${filePath}`);
			}
		}

		// Step 3: Delete database records in batches within a transaction
		console.log('Deleting database records in batches...');
		await sequelize.transaction(async (t) => {
			await deleteInBatches(PostVotes, { post_id: { [Op.like]: likePattern } }, t, 'PostVotes');
			await deleteInBatches(SavedPosts, { post_id: { [Op.like]: likePattern } }, t, 'SavedPosts');
			await deleteInBatches(ViewedPosts, { post_id: { [Op.like]: likePattern } }, t, 'ViewedPosts');
			await deleteInBatches(Posts, { post_id: { [Op.like]: likePattern } }, t, 'Posts');
			await deleteInBatches(FeedChannels, { channel_id: { [Op.like]: likePattern } }, t, 'FeedChannels');
			await deleteInBatches(Followers, { feed_id: { [Op.like]: likePattern } }, t, 'Followers');
			await deleteInBatches(Feeds, { feed_id: { [Op.like]: likePattern } }, t, 'Feeds');
			await deleteInBatches(Users, { user_id: { [Op.like]: likePattern } }, t, 'Users');
		});

		console.log('Test data removed successfully.');
	} catch (error) {
		console.error('Error cleaning up test data:', error);
	}
}

cleanupTestData();