import { Op } from 'sequelize';
//import redis from '../app.js';
import { Posts } from '../models/relationships.js';

//One-time population of redis, how do I check if this has already been applied?
//(async () => {
	//try {
		//console.log('Backfilling Redis hotness...');
		//const posts = await Posts.findAll({ raw: true });
		//let count = 0;
		//for (const post of posts) {
			//await updateHotnessRedis(post);
			//count++;
			//if (count % 500 === 0) console.log(`Processed ${count} posts...`);
		//}
		//console.log(`✅ Done. Added ${count} posts to Redis.`);
		//process.exit(0);
	//} catch (error) {
		//console.error('❌ Backfill failed:', error);
		//process.exit(1);
	//}
//})();

//Core hotness ranking formula
export function computeHotness({ upvotes = 0, downvotes = 0, createdAt, referenceTime = Date.now() / 1000, boost = 1.0, decayBase = 150000 }) {
	const score = upvotes - downvotes;
	const age = (referenceTime - new Date(createdAt).getTime() / 1000);
	const freshness = Math.exp(-age / decayBase);
	//Small bias so new posts start slightly below strong ones
	if (score === 0) return (-0.1 * freshness) - (age / decayBase);
	//Downvote penalty grows faster than upvote reward
	if (score < 0) {
		const penalty = Math.pow(Math.log10(1 + Math.abs(score)), 2.5) * 3;
		return (-penalty * freshness) - (age / (decayBase / 3));
	}
	//Positive score: logarithmic growth with much stronger recency bias
	const order = Math.log10(score + 1);
	//Increase freshness weight to favor recent posts more
	const boostFactor = (1 + Math.pow(order, 1.4) * boost) * Math.pow(freshness, 0.7);
	const decay = age / (decayBase * (1 + order * 0.2));
	return boostFactor - decay;
}

//Update Redis whenever post is created, viewed, or voted
export async function updateHotnessRedis(post) {
	const now = Math.floor(Date.now() / 1000);
	//const hotness = computeHotness({
		//upvotes: post.upvotes || 0,
		//downvotes: post.downvotes || 0,
		//createdAt: post.created_at,
		//referenceTime: now
	//});
	//Store hash for direct lookup
	//await redis.hset(`post:rank:${post.post_id}`, { hotness, updated_at: now });
	//await redis.expire(`post:rank:${post.post_id}`, 86400);
	//Determine environment key
	//const envKey = post.environment
		//? `hotness:${post.environment}`
		//: 'hotness:explore';
	//Add to environment-specific sorted set
	//await redis.zadd(envKey, hotness, post.post_id);
	//Also keep a global fallback
	//await redis.zadd('hotness:global', hotness, post.post_id);
}

//Get current hotness (Redis first, fallback MySQL)
export async function getHotness(post) {
	//const zscore = await redis.zscore(`hotness:${post.environment || 'explore'}`, post.post_id);
	//if (zscore) return parseFloat(zscore);
	//const cached = await redis.hgetall(`post:rank:${post.post_id}`);
	//if (cached?.hotness) return parseFloat(cached.hotness);
	//return post.rank_hotness ?? 0;
}

//Batch sync to MySQL (called by worker)
export async function flushRedisToMySQL(limit = 10000) {
	//const keys = await redis.keys('hotness:*');
	let count = 0;
	//for (const key of keys) {
		//const ids = await redis.zrange(key, 0, -1, 'WITHSCORES');
		//for (let i = 0; i < ids.length; i += 2) {
			//const postId = ids[i];
			//const hotness = parseFloat(ids[i + 1]);
			//await Posts.update({ rank_hotness: hotness }, { where: { post_id: postId } });
			//count++;
			//if (count >= limit) return count;
		//}
	//}
	return count;
}