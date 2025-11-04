import redis from '../app.js';
import { Posts } from '../models/relationships.js';

//Core formula
export function computeHotness({ upvotes = 0, downvotes = 0, createdAt, decayBase = 90000, referenceTime }) {
	const score = (upvotes - downvotes) || 1; // give unseen posts minimal weight
	const order = Math.log10(Math.max(Math.abs(score), 1));
	const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
	const age = (referenceTime - new Date(createdAt).getTime() / 1000);
	return order + (sign * age / decayBase);
}

//Update Redis whenever post is created, viewed, or voted
export async function updateHotnessRedis(post) {
	const now = Math.floor(Date.now() / 1000);
	const hotness = computeHotness({
		upvotes: post.upvotes || 0,
		downvotes: post.downvotes || 0,
		createdAt: post.created_at,
		referenceTime: now
	});
	//Store hash for direct lookup
	await redis.hset(`post:rank:${post.post_id}`, { hotness, updated_at: now });
	await redis.expire(`post:rank:${post.post_id}`, 86400);
	//Determine environment key
	const envKey = post.environment
		? `hotness:${post.environment}`
		: 'hotness:explore';
	//Add to environment-specific sorted set
	await redis.zadd(envKey, hotness, post.post_id);
	//Also keep a global fallback
	await redis.zadd('hotness:global', hotness, post.post_id);
}

//Get current hotness (Redis first, fallback MySQL)
export async function getHotness(post) {
	const zscore = await redis.zscore(`hotness:${post.environment || 'explore'}`, post.post_id);
	if (zscore) return parseFloat(zscore);
	const cached = await redis.hgetall(`post:rank:${post.post_id}`);
	if (cached?.hotness) return parseFloat(cached.hotness);
	return post.rank_hotness ?? 0;
}

//Batch sync to MySQL (called by worker)
export async function flushRedisToMySQL(limit = 10000) {
	const keys = await redis.keys('hotness:*');
	let count = 0;
	for (const key of keys) {
		const ids = await redis.zrange(key, 0, -1, 'WITHSCORES');
		for (let i = 0; i < ids.length; i += 2) {
			const postId = ids[i];
			const hotness = parseFloat(ids[i + 1]);
			await Posts.update({ rank_hotness: hotness }, { where: { post_id: postId } });
			count++;
			if (count >= limit) return count;
		}
	}
	return count;
}