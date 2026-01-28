import { ExternalPostsAccess, PaginationTokens } from "../../models/content.js";
import { fetchAndProcessPosts } from "./fetchAndProcessPosts.js";
import { GenerateBlueskyHTML } from "./generate_html/generateBlueskyHTMl.js";
import { GenerateMastodonHTML } from "./generate_html/generateMastodonHTML.js";
import { GenerateRedditHTML } from "./generate_html/generateRedditHTML.js";
import { mapBlueskyToExternal } from "./map_to_external/mapBlueskyToExternal.js";
import { mapRedditToExternal } from "./map_to_external/mapRedditToExternal.js";
import { mapMastodonToExternal } from "./map_to_external/mapMastodonToExternal.js";
import { ua } from "./ua.js";

export async function processAccount(account) {
	try {
		const { access_token, instance_url, platform, user_id } = account;
		const accessCount = await ExternalPostsAccess.count({ where: { user_id, source: platform } });
		let paginationToken = await PaginationTokens.findOne({
			where: { user_id, platform }
		});
		if (accessCount === 0) {
			paginationToken = null;
		}
		const configs = {
			bluesky: {
				url: paginationToken?.cursor 
					? `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=100&cursor=${paginationToken.cursor}`
					: `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=100`,
				headers: { 
					'Authorization': `Bearer ${access_token}`, 
					'Content-Type': 'application/json' 
				},
				mapper: mapBlueskyToExternal,
				htmlGenerator: GenerateBlueskyHTML,
				limit: 100
			},
			reddit: {
				url: paginationToken?.after 
					? `https://oauth.reddit.com/best?limit=100&after=${paginationToken.after}`
					: `https://oauth.reddit.com/best?limit=100`,
				headers: {
					'Authorization': `bearer ${access_token}`,
					'User-Agent': ua()
				},
				mapper: mapRedditToExternal,
				htmlGenerator: GenerateRedditHTML,
				limit: 100
			},
			mastodon: {
				url: paginationToken?.max_id 
					? `${instance_url}/api/v1/timelines/home?limit=40&max_id=${paginationToken.max_id}`
					: `${instance_url}/api/v1/timelines/home?limit=40`,
				headers: { Authorization: `Bearer ${access_token}` },
				mapper: mapMastodonToExternal,
				htmlGenerator: GenerateMastodonHTML,
				limit: 40, //Mastodon has a lower api limit
				instance: instance_url
			}
		};
		const config = configs[platform];
		if (!config) {
			console.log(`Unknown platform: ${platform}`);
			return;
		}
		await fetchAndProcessPosts(platform, config, user_id);
	} catch (error) {
		console.error(new Date().toISOString(), `Error processing ${account.platform} account:`, error);
	}
}