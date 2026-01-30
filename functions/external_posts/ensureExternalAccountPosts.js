import { ConnectedAccounts } from "../../models/users.js";
import { ExternalAccountMeta } from "../../models/content.js";
import { fetchBlueskyAccountPosts } from "./fetch_account_posts/fetchBlueskyAccountPosts.js";
import { fetchMastodonAccountPosts } from "./fetch_account_posts/fetchMastodonAccountPosts.js";
import { GenerateBlueskyHTML } from "./generate_html/generateBlueskyHTML.js";
import { GenerateMastodonHTML } from "./generate_html/generateMastodonHTML.js";
import { refreshBlueskyToken } from "./token_refresh/refreshBlueskyToken.js";
import { processQuick } from "./background_processing/processQuick.js";
import { v4 } from 'uuid';

//Ensure posts exist in DB for an external account (fetch from API if needed)
export async function ensureExternalAccountPosts(userId, platform, authorHandle, authorDid, cursor = null, instanceUrl = null) {
	const connectedAccount = await ConnectedAccounts.findOne({
		where: { user_id: userId, platform },
		attributes: ['access_token', 'instance_url'],
		raw: true
	});
	if (!connectedAccount?.access_token) return { success: false, cursor: null };
	let accessToken = connectedAccount.access_token;
	const instance = instanceUrl || connectedAccount.instance_url;
	try {
		if (platform === 'bluesky') {
			let data;
			try {
				data = await fetchBlueskyAccountPosts(authorHandle, accessToken, cursor, 100);
			} catch (fetchErr) {
				if (fetchErr.message?.includes('ExpiredToken')) {
					const newToken = await refreshBlueskyToken(userId);
					if (!newToken) return { success: false, cursor: null };
					accessToken = newToken;
					data = await fetchBlueskyAccountPosts(authorHandle, newToken, cursor, 100);
				} else {
					throw fetchErr;
				}
			}
			if (!data?.feed?.length) return { success: true, cursor: null };
			//Filter to only this author's posts (no reposts/replies)
			const apiPosts = data.feed.filter(item => {
				if (item.reply) return false;
				const postAuthorHandle = item.post?.author?.handle;
				const postAuthorDid = item.post?.author?.did;
				return postAuthorHandle === authorHandle || postAuthorDid === authorDid;
			});
			//Extract actual handle from API response (don't store DIDs in handle column)
			let actualHandle = authorHandle;
			if (actualHandle?.startsWith('did:') && apiPosts.length > 0) {
				actualHandle = apiPosts[0].post?.author?.handle || null;
			} else if (actualHandle?.startsWith('did:')) {
				actualHandle = null;
			}
			//Store posts and cursor
			if (apiPosts.length > 0) {
				await processQuick(platform, authorDid, apiPosts, GenerateBlueskyHTML);
			}
			//Always update last_fetched_at timestamp
			const [meta, created] = await ExternalAccountMeta.findOrCreate({
				where: { account_id: authorDid, platform },
				defaults: {
					id: v4(),
					handle: actualHandle,
					cursor: data.cursor || null,
					last_fetched_at: new Date(),
					updated_at: new Date()
				}
			});
			if (!created) {
				await meta.update({
					handle: actualHandle,
					cursor: data.cursor || null,
					last_fetched_at: new Date(),
					updated_at: new Date()
				});
			}
			return { success: true, cursor: data.cursor };
		} else if (platform === 'mastodon') {
			const data = await fetchMastodonAccountPosts(authorDid, accessToken, instance, cursor, 40);
			if (!Array.isArray(data) || data.length === 0) return { success: true, cursor: null };
			//Extract actual handle from API response (don't store DIDs in handle column)
			let actualHandle = authorHandle;
			if (actualHandle?.startsWith('did:') && data.length > 0) {
				actualHandle = data[0].account?.acct || data[0].account?.username || null;
			} else if (actualHandle?.startsWith('did:')) {
				actualHandle = null;
			}
			//Store posts
			if (data.length > 0) {
				await processQuick(platform, authorDid, data, GenerateMastodonHTML, instance);
			}
			//Store cursor (maxId is the last post's ID)
			const nextCursor = data.length > 0 ? data[data.length - 1].id : null;
			//Always update last_fetched_at timestamp
			const [meta2, created2] = await ExternalAccountMeta.findOrCreate({
				where: { account_id: authorDid, platform },
				defaults: {
					id: v4(),
					handle: actualHandle,
					cursor: nextCursor,
					last_fetched_at: new Date(),
					updated_at: new Date()
				}
			});
			if (!created2) {
				await meta2.update({
					handle: actualHandle,
					cursor: nextCursor,
					last_fetched_at: new Date(),
					updated_at: new Date()
				});
			}
			return { success: true, cursor: nextCursor };
		}
		return { success: false, cursor: null };
	} catch (err) {
		console.error(new Date().toISOString(), '[ensureExternalAccountPosts] Error:', err.message);
		return { success: false, cursor: null };
	}
}