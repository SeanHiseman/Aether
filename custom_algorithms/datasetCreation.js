import { faker } from '@faker-js/faker';
import sequelize from '../databaseSetup.js';
import { Feeds, FeedChannels, Posts, Users } from '../models/relationships.js';

//Special id's to distinguish fake posts
function generateSpecialId() {
	return '111111111111' + faker.string.alphanumeric({ length: 24 });
}

async function generateData() {
	try {
		const NUM_FEEDS = 200;      
		const POSTS_PER_CHANNEL = 100; 
		const feedsData = [];
		const channelsData = [];
		const postsData = [];
        const usersData = [];
		for (let i = 0; i < NUM_FEEDS; i++) {
			const userId = generateSpecialId();
			const username = faker.internet.userName();
			usersData.push({
				user_id: userId,
				username: username,
				password: faker.internet.password(), 
				email: faker.internet.email(),
				email_verified: true,
			});
			const feedId = generateSpecialId();
			feedsData.push({
				feed_id: feedId,
				feed_name: username,
				description: faker.lorem.sentence(),
				feed_photo: faker.image.avatar(),
				follower_count: faker.number.int({ min: 0, max: 10000 }),
				type: 'public',
				is_group: false,
				feed_owner: userId,
				is_locked: faker.datatype.boolean(),
				created_at: new Date(),
				updated_at: new Date()
			});
			const channelId = generateSpecialId();
			channelsData.push({
				channel_id: channelId,
				channel_name: 'Main Channel',
				description: faker.lorem.sentence(),
				feed_id: feedId,
				is_posts: true,
				is_chat: true,
				display_order: 0,
				created_at: new Date(),
				updated_at: new Date()
			});
			for (let j = 0; j < POSTS_PER_CHANNEL; j++) {
				postsData.push({
					post_id: generateSpecialId(),
					feed_id: feedId,
					channel_id: channelId,
					title: faker.datatype.boolean() ? faker.lorem.sentence({ min: 3, max: 8 }) : null,
					content: faker.lorem.paragraphs({ min: 1, max: 3 }, '\n\n'),
					replies: faker.number.int({ min: 0, max: 100 }),
					views: faker.number.int({ min: 10, max: 10000 }),
					upvotes: faker.number.int({ min: 0, max: 500 }),
					downvotes: faker.number.int({ min: 0, max: 100 }),
					created_at: faker.date.recent({ days: 30 }),
					poster_id: feedId
				});
			}
		}
		await sequelize.transaction(async (t) => {
			await Users.bulkCreate(usersData, { transaction: t });
			await Feeds.bulkCreate(feedsData, { transaction: t });
			await FeedChannels.bulkCreate(channelsData, { transaction: t });
			await Posts.bulkCreate(postsData, { transaction: t });
		});
		console.log(`Created ${usersData.length} users, ${feedsData.length} feeds, ${channelsData.length} channels, and ${postsData.length} posts.`);
	} catch (error) {
		console.error('Error generating data:', error);
	}
}

generateData();