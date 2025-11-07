import { computeHotness } from '../functions/postRanking.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 } from 'uuid';
import { Feeds, FeedChannels, Posts, Users } from '../models/relationships.js';

const contentAnalyser = new ContentAnalyser();

//Special ID's for fake data
function generateSpecialId() {
	return '111111111111' + faker.string.alphanumeric({ length: 24 });
}

const topics = [
	'Technology', 'Sports', 'Finance', 'Movies', 'Politics',
	'Fitness', 'Travel', 'Science', 'Gaming', 'Food'
];

const templates = {
	Technology: [
		`Latest update in tech: ${faker.commerce.productName()} is changing the game.`,
		`Is AI going too far? ${faker.word.adjective()} ${faker.word.noun()} could be the reason.`,
		`${faker.company.name()} just launched a new gadget that might replace your phone.`,
		`5 things you need to know about ${faker.word.noun()} in technology today.`
	],
	Sports: [
		`Can ${faker.person.firstName()} lead ${faker.location.city()} to victory this season?`,
		`${faker.word.adjective()} performance by ${faker.person.lastName()} last night.`,
		`Top 10 moments in ${faker.helpers.arrayElement(['football', 'basketball', 'tennis'])} history.`,
		`Big upset in last night's game! ${faker.company.catchPhrase()}`
	],
	Finance: [
		`Markets are volatile again. ${faker.finance.accountName()} reports major losses.`,
		`Is ${faker.finance.currencyName()} still a good investment?`,
		`Experts predict a rise in ${faker.commerce.department()} sector stocks.`,
		`Here’s why ${faker.company.name()} stock is trending this week.`
	],
	Movies: [
		`${faker.person.firstName()} stars in the new blockbuster "${faker.word.adjective()} ${faker.word.noun()}".`,
		`Is "${faker.word.noun()}" the best film of the year?`,
		`Box office hits: "${faker.word.adjective()} ${faker.word.noun()}" dominates charts.`,
		`Here are the top 5 films to watch this weekend.`
	],
	Politics: [
		`${faker.person.firstName()} makes a shocking policy announcement.`,
		`Elections in ${faker.location.country()}: voter turnout hits record high.`,
		`Policy changes are coming: ${faker.word.adjective()} reforms announced.`,
		`Why everyone’s talking about ${faker.word.noun()} in politics this week.`
	],
	Fitness: [
		`Top tips for building muscle this summer without expensive equipment.`,
		`${faker.number.int({ min: 10, max: 30 })}-minute workout to burn fat fast.`,
		`Is ${faker.commerce.productName()} the best supplement for fitness?`,
		`How to stay fit and healthy without going to the gym.`
	],
	Travel: [
		`You won’t believe these hidden spots in ${faker.location.country()}.`,
		`Top destinations for ${new Date().getFullYear()}.`,
		`Budget travel tips for ${faker.location.city()} you need to know.`,
		`Here’s why you should visit ${faker.location.country()} this year.`
	],
	Science: [
		`New breakthrough in ${faker.science.chemicalElement().name}.`,
		`Why ${faker.word.noun()} could change everything in modern science.`,
		`Latest research from ${faker.company.name()} scientists.`,
		`Space discovery shocks experts: ${faker.word.adjective()} results revealed.`
	],
	Gaming: [
		`Best strategy to win in the game ${faker.word.noun()}.`,
		`Is this the most addictive game ever? Find out now.`,
		`${faker.person.firstName()} just broke the world record in gaming.`,
		`Top 10 games you should play right now before everyone else does.`
	],
	Food: [
		`Why everyone loves ${faker.food.dish()} and how to make it.`,
		`Top recipes for ${faker.food.adjective()} meals this week.`,
		`${faker.food.ingredient()} is trending in the food world right now.`,
		`Is ${faker.food.dish()} the ultimate comfort food?`
	]
};

function generatePost(topic) {
	const contentTemplate = faker.helpers.arrayElement(templates[topic]);
	const emojis = faker.helpers.multiple(() => faker.internet.emoji(), { count: 2 }).join(' ');
	const hashtags = `#${faker.word.noun()} #${topic.toLowerCase()}`;
	return `${contentTemplate} ${emojis}\n\n${hashtags}`;
}

async function generateData() {
	try {
		const NUM_FEEDS = 200;
		const POSTS_PER_CHANNEL = 200;
		const feedsData = [];
		const channelsData = [];
		const postsData = [];
		const usersData = [];
		const channelMap = new Map();
		for (let i = 0; i < NUM_FEEDS; i++) {
			const userId = generateSpecialId();
			const username = faker.internet.username();
			usersData.push({
				user_id: userId,
				username: username,
				password: faker.internet.password(),
				email: faker.internet.email(),
				email_verified: true
			});
			const feedId = generateSpecialId();
			feedsData.push({
				feed_id: feedId,
				feed_name: username,
				description: `${faker.helpers.arrayElement(['Tech enthusiast', 'Sports fan', 'Finance guru', 'Movie buff', 'Globetrotter', 'Fitness addict'])} sharing updates.`,
				feed_photo: `/media/site_images/Logo.png`,
				follower_count: faker.number.int({ min: 0, max: 100000 }),
				type: 'public',
				is_group: false,
				feed_owner: userId,
				is_locked: false
			});
			const mainChannelId = generateSpecialId();
			channelsData.push({
				channel_id: mainChannelId,
				channel_name: 'Main',
				feed_id: feedId,
				is_posts: true,
				is_chat: false
			});
			const topicChannels = {};
			for (const topic of topics) {
				const channelId = generateSpecialId();
				channelsData.push({
					channel_id: channelId,
					channel_name: topic,
					feed_id: feedId,
					is_posts: true,
					is_chat: false
				});
				topicChannels[topic] = channelId;
			}
			channelMap.set(feedId, { main: mainChannelId, topics: topicChannels });
			const tweetCSV = fs.readFileSync('custom_algorithms/twitter_validation.csv', 'utf8');
			const tweetRows = parse(tweetCSV, { columns: false, skip_empty_lines: true });
			for (let j = 0; j < POSTS_PER_CHANNEL; j++) {
				const topic = faker.helpers.arrayElement(topics);
				const channelId = topicChannels[topic];
				let htmlContent;
				let postTitle;
				if (tweetRows.length > 0 && Math.random() < 0.5) {
					const tweet = tweetRows[Math.floor(Math.random() * tweetRows.length)];
					const tweetContent = tweet[3];
					postTitle = `${topic} Discussion: ${faker.company.catchPhrase()}`;
					htmlContent = `<html><head></head><body><div class="content-block text-block" data-blockid="${v4()}"><p>${tweetContent}</p></div></body></html>`;
				} else {
					postTitle = faker.helpers.arrayElement([
						`${topic} Insights: ${faker.word.adjective()} ${faker.word.noun()}`,
						`Breaking ${topic} News: ${faker.company.catchPhrase()}`,
						`Top ${faker.number.int({ min: 5, max: 15 })} ${topic} Tips`
					]);
					htmlContent = `<html><head></head><body><div class="content-block text-block" data-blockid="${v4()}"><p>${generatePost(topic)}</p></div></body></html>`;
				}
				const postId = generateSpecialId();
				const filePath = `/media/posts/post-${v4()}.html`;
				fs.writeFileSync(`.${filePath}`, htmlContent, 'utf8');
				const analysisResults = await contentAnalyser.analyseContent(htmlContent, null);
				const upvotes = faker.number.int({ min: 0, max: 50000 });
				const downvotes = faker.number.int({ min: 0, max: 30000 });
				const created_at = faker.date.recent({ days: 60 });
				const now = Math.floor(Date.now() / 1000);
				const rank_hotness = computeHotness({
					upvotes,
					downvotes,
					createdAt: created_at,
					referenceTime: now
				});
				const post = {
					post_id: postId,
					feed_id: feedId,
					channel_id: channelId,
					title: postTitle,
					content: filePath, //store only path in DB
					replies: faker.number.int({ min: 0, max: 10000 }),
					views: faker.number.int({ min: 10, max: 1000000 }),
					upvotes,
					downvotes,
					created_at,
					poster_id: feedId,
					rank_hotness,
					...analysisResults
				};
				postsData.push(post);
			}
		}
		await Users.bulkCreate(usersData);
		await Feeds.bulkCreate(feedsData);
		await FeedChannels.bulkCreate(channelsData);
		const BATCH_SIZE = 100;
		for (let i = 0; i < postsData.length; i += BATCH_SIZE) {
			const batch = postsData.slice(i, i + BATCH_SIZE);
			await Posts.bulkCreate(batch);
			console.log(`Inserted posts ${i + 1}–${i + batch.length} of ${postsData.length}`);
		}

		console.log(`Created ${usersData.length} users, ${feedsData.length} feeds, ${channelsData.length} channels, and ${postsData.length} posts.`);
	} catch (error) {
		console.error('Error generating data:', error);
	}
}

generateData();