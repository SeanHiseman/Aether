import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import cron from 'node-cron';
import crypto from 'crypto';
import { ConnectedAccounts, Users } from '../models/users.js';
import dotenv from 'dotenv';
import { ensureExternalAccountPosts } from '../functions/external_posts/ensureExternalAccountPosts.js';
import { ExternalAccountMeta, ExternalFollows, ExternalPosts, ExternalPostsAccess, ExternalPostVotes, PaginationTokens } from '../models/relationships.js';
import express from 'express';
import fetch from 'node-fetch';
import { fetchAndProcessPosts } from '../functions/external_posts/fetchAndProcessPosts.js';
import { formatExternalPost } from '../functions/external_posts/formatExternalPost.js';
import { GenerateBlueskyHTML } from '../functions/external_posts/generate_html/generateBlueskyHTML.js';
import { GenerateRedditHTML } from '../functions/external_posts/generate_html/generateRedditHTML.js';
import { GenerateMastodonHTML } from '../functions/external_posts/generate_html/generateMastodonHTML.js';
import { mapBlueskyToExternal } from '../functions/external_posts/map_to_external/mapBlueskyToExternal.js';
import { mapMastodonToExternal } from '../functions/external_posts/map_to_external/mapMastodonToExternal.js';
import { mapRedditToExternal } from '../functions/external_posts/map_to_external/mapRedditToExternal.js';
import { Op } from 'sequelize';
import { processAccount } from '../functions/external_posts/processAccount.js';
import sequelize from '../databaseSetup.js';
import { ua } from '../functions/external_posts/ua.js';
import { v4 } from 'uuid';

dotenv.config();
const router = express.Router();

const OAUTH_AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
const OAUTH_TOKEN = 'https://www.reddit.com/api/v1/access_token';
const OAUTH_ME = 'https://oauth.reddit.com/api/v1/me';

export const FEED_CONFIG = {
    bluesky: {
        generator: GenerateBlueskyHTML,
        defaultIcon: '/media/site_images/default-bluesky-user-icon.png',
        sourceName: 'Bluesky',
        getProfileUrl: (p) => p.author ? `https://bsky.app/profile/${p.author}` : null,
        getChannel: (p) => p.channel,
    },
    reddit: {
        generator: GenerateRedditHTML,
        defaultIcon: '/media/site_images/default-reddit-user-icon.png',
        sourceName: 'Reddit',
        getProfileUrl: (p) => {
            const username = (p.author || '').replace('u/', '');
            return `https://www.reddit.com/user/${username}`;
        },
        getChannel: (p) => p.channel || 'reddit',
        mapExtras: (p) => ({ 
            title: p.title,
            upvotes: p.score ?? 0 //Reddit maps score to upvotes
        })
    },
    mastodon: {
        generator: GenerateMastodonHTML,
        defaultIcon: null, //Add default if you have one, or handle logic below
        sourceName: 'Mastodon',
        getProfileUrl: (p) => p.url,
        getChannel: (p) => p.author, //not p.channel
    }
};

router.post('/auth/bluesky', authenticateCheck, async (req, res) => {
	try {
		const { identifier, appPassword } = req.body;
		const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier, password: appPassword })
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.message || errorData.error || 'Invalid handle or app password';
			console.error(new Date().toISOString(), '[Bluesky Auth] Failed:', response.status, errorMessage);
			return res.status(400).json({ success: false, message: errorMessage });
		}
		const json = await response.json();
		await ConnectedAccounts.upsert({
			user_id: req.user.user_id,
			platform: 'bluesky',
			handle: identifier,
			account_id: json.did,
			instance_url: 'https://bsky.social',
			access_token: json.accessJwt,
			refresh_token: json.refreshJwt,
			extra: JSON.stringify(json)
		});
		//Fetch and store Bluesky follows
		let blueskyFollows = [];
		try {
			let cursor = null;
			const allFollows = [];
			do {
				const followsUrl = cursor
					? `https://bsky.social/xrpc/app.bsky.graph.getFollows?actor=${encodeURIComponent(json.did)}&limit=100&cursor=${cursor}`
					: `https://bsky.social/xrpc/app.bsky.graph.getFollows?actor=${encodeURIComponent(json.did)}&limit=100`;
				const followsResponse = await fetch(followsUrl, {
					headers: { 'Authorization': `Bearer ${json.accessJwt}` }
				});
				if (followsResponse.ok) {
					const followsData = await followsResponse.json();
					allFollows.push(...(followsData.follows || []));
					cursor = followsData.cursor;
				} else {
					break;
				}
			} while (cursor);
			//Store follows in database
			for (const follow of allFollows) {
				await ExternalFollows.upsert({
					id: v4(),
					user_id: req.user.user_id,
					did: follow.did,
					handle: follow.handle,
					display_name: follow.displayName || null,
					avatar: follow.avatar || null,
					description: follow.description || null,
					platform: 'bluesky',
				});
			}
			//Fetch stored follows
			blueskyFollows = await ExternalFollows.findAll({
				where: { user_id: req.user.user_id, platform: 'bluesky' },
				order: [['display_name', 'ASC'], ['handle', 'ASC']]
			});
		} catch (followsError) {
			console.error(new Date().toISOString(), 'Error fetching Bluesky follows:', followsError);
		}
		const config = {
			url: `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=100`,
			headers: {
				'Authorization': `Bearer ${json.accessJwt}`,
				'Content-Type': 'application/json'
			},
			mapper: mapBlueskyToExternal,
			htmlGenerator: GenerateBlueskyHTML,
			limit: 100
		};
		try {
			const mappedPosts = await fetchAndProcessPosts('bluesky', config, req.user.user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			//Return posts immediately
			const postsWithContent = await Promise.all(
				mappedPosts.map(async (p) => {
					const formatted = formatExternalPost(p, FEED_CONFIG.bluesky, 'bluesky');
					formatted.content = await FEED_CONFIG.bluesky.generator(p.text_body, p.media);
					return formatted;
				})
			);
            res.status(200).json({ success: true, did: json.did, posts: postsWithContent, blueskyFollows });
		} catch (fetchError) {
			res.status(200).json({ success: true, did: json.did, posts: [], blueskyFollows });
		}
	} catch (error) {
		console.error(new Date().toISOString(), '/auth/bluesky error:', error);
		res.status(400).json({ success: false, error: error.message });
	}
});

router.get('/auth/reddit', authenticateCheck, async (req, res) => {
	try {
		const { REDDIT_CLIENT_ID, REDDIT_REDIRECT_URI } = process.env;
		const userId = req.user.user_id;
		const statePayload = {
			user_id: userId,
			nonce: crypto.randomBytes(16).toString('hex')
		};
		req.session.reddit_oauth_nonce = statePayload.nonce;
		const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
		const scope = ['identity','read','mysubreddits','history'].join(' ');
		const url =
			`${OAUTH_AUTHORIZE}?client_id=${encodeURIComponent(REDDIT_CLIENT_ID)}` +
			`&response_type=code` +
			`&state=${encodeURIComponent(state)}` +
			`&redirect_uri=${encodeURIComponent(REDDIT_REDIRECT_URI)}` +
			`&duration=permanent` +
			`&scope=${encodeURIComponent(scope)}`;

		res.redirect(url);
	} catch (error) {
		console.error(new Date().toISOString(), '/auth/reddit error:', error);
		res.status(500).send('Reddit auth setup failed');
	}
});

router.post('/auth/mastodon', authenticateCheck, async (req, res) => {
	try {
		const { instance } = req.body;
		if (!instance) {
			return res.status(400).json({ success: false, error: 'Missing instance' });
		}
		const base = `https://${instance}`;
		const registerResponse = await fetch(`${base}/api/v1/apps`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: "Aether Social",
				redirect_uris: process.env.MASTODON_REDIRECT_URI,
				scopes: "read write follow",
				website: "https://aethersocial.com"
			})
		});
		const app = await registerResponse.json();
		if (!registerResponse.ok || !app.client_id) {
			return res.status(500).json({ success: false, error: 'App registration failed' });
		}
		req.session.mastodon_instance = base;
		req.session.mastodon_client_id = app.client_id;
		req.session.mastodon_client_secret = app.client_secret;
		await ConnectedAccounts.upsert({
			id: v4(),
			user_id: req.user.user_id,
			platform: 'mastodon',
			handle: null,
			instance_url: base,
			access_token: null,
			refresh_token: null,
			expires_at: null,
			extra: JSON.stringify({
				instance,
				client_id: app.client_id,
				client_secret: app.client_secret
			})
		});
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: app.client_id,
			redirect_uri: process.env.MASTODON_REDIRECT_URI,
			scope: 'read write follow',
			state: JSON.stringify({ instance, user_id: req.user.user_id })
		});
		res.status(200).json({ success: true, url: `${base}/oauth/authorize?${params.toString()}` });
	} catch (error) {
		console.error(new Date().toISOString(), '/auth/mastodon error:', error);
		res.status(500).json({ success: false });
	}
});

router.get('/reddit/callback', authenticateCheck, async (req, res) => {
	try {
		const code = req.query.code;
		if (!code) {
			return res.redirect('/explore');
		}
		const user_id = req.user.user_id;
		const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: process.env.REDDIT_REDIRECT_URI
			})
		});
		if (!tokenResponse.ok) {
			return res.redirect('/feed/reddit?error=1');
		}
		const tokenJson = await tokenResponse.json();
		const meResp = await fetch(OAUTH_ME, {
			headers: {
				'Authorization': `bearer ${tokenJson.access_token}`,
				'User-Agent': ua()
			}
		});
		const meJson = await meResp.json();
		const redditHandle = meJson?.name ? `u/${meJson.name}` : null;
		await ConnectedAccounts.upsert({
			user_id,
			platform: 'reddit',
			handle: redditHandle,
			access_token: tokenJson.access_token,
			refresh_token: tokenJson.refresh_token,
			instance_url: 'https://reddit.com',
			extra: JSON.stringify(tokenJson)
		});
		const config = {
			url: `https://oauth.reddit.com/best?limit=100`,
			headers: {
				'Authorization': `bearer ${tokenJson.access_token}`,
				'User-Agent': ua()
			},
			mapper: mapRedditToExternal,
			htmlGenerator: GenerateRedditHTML,
			limit: 100
		};
		try {
			const mappedPosts = await fetchAndProcessPosts('reddit', config, user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			const postsData = await Promise.all(
				mappedPosts.map(async (p) => {
					const formatted = formatExternalPost(p, FEED_CONFIG.reddit, 'reddit');
					formatted.content = await FEED_CONFIG.reddit.generator(p.content, p.media);
					return formatted;
				})
			);
			//HTML to contain post data
			res.send(`
				<!DOCTYPE html>
				<html>
				<body>
					<script>
						sessionStorage.setItem('reddit_initial_posts', ${JSON.stringify(JSON.stringify(postsData))});
						window.location.href = '/feed/reddit?connected=true';
					</script>
				</body>
				</html>
			`);
		} catch (fetchError) {
			res.redirect('/feed/reddit');
		}
	} catch (error) {
		console.error(new Date().toISOString(), '/reddit/callback error:', error);
		res.redirect('/feed/reddit?error=1');
	}
});

router.get('/mastodon/callback', authenticateCheck, async (req, res) => {
	try {
		const code = req.query.code;
		if (!code) {
			return res.redirect('/explore');
		}
		const user_id = req.user.user_id;
		const instance = req.session.mastodon_instance;
		const token_url = `${instance}/oauth/token`;
		const tokenResponse = await fetch(token_url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: req.session.mastodon_client_id,
				client_secret: req.session.mastodon_client_secret,
				grant_type: 'authorization_code',
				code,
				redirect_uri: process.env.MASTODON_REDIRECT_URI
			})
		});
		if (!tokenResponse.ok) {
			return res.redirect('/feed/mastodon?error=1');
		}
		const tokenJson = await tokenResponse.json();
		//Get user account info and follows
		let mastodonHandle = null;
		let mastodonAccountId = null;
		let mastodonFollows = [];
		try {
			const credentialsResponse = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
				headers: { 'Authorization': `Bearer ${tokenJson.access_token}` }
			});
			if (credentialsResponse.ok) {
				const credentials = await credentialsResponse.json();
				mastodonHandle = credentials.acct;
				mastodonAccountId = credentials.id;
				const accountId = credentials.id;
				//Paginate through follows with rate limit consideration
				let maxId = null;
				const allFollows = [];
				let pageCount = 0;
				const MAX_PAGES = 5; //Limit to 5 pages (400 follows) to avoid rate limits
				do {
					const followsUrl = maxId
						? `${instance}/api/v1/accounts/${accountId}/following?limit=80&max_id=${maxId}`
						: `${instance}/api/v1/accounts/${accountId}/following?limit=80`;
					const followsResponse = await fetch(followsUrl, {
						headers: { 'Authorization': `Bearer ${tokenJson.access_token}` }
					});
					if (followsResponse.ok) {
						const followsData = await followsResponse.json();
						if (followsData.length === 0) break;
						allFollows.push(...followsData);
						//Mastodon uses the last item id as max_id for pagination
						maxId = followsData[followsData.length - 1]?.id;
						pageCount++;
						//Add delay between requests to avoid rate limiting
						if (maxId && pageCount < MAX_PAGES) {
							await new Promise(resolve => setTimeout(resolve, 1000)); //1 second delay
						}
					} else {
						break;
					}
				} while (maxId && pageCount < MAX_PAGES);
				//Store follows in database
				for (const follow of allFollows) {
					await ExternalFollows.upsert({
						id: v4(),
						user_id: req.user.user_id,
						did: follow.id, //Mastodon uses numeric IDs
						handle: follow.acct,
						display_name: follow.display_name || null,
						avatar: follow.avatar || null,
						description: follow.note ? follow.note.replace(/<[^>]*>/g, '').trim() : null, //Strip HTML from bio
						platform: 'mastodon',
					});
				}
				//Fetch stored follows
				mastodonFollows = await ExternalFollows.findAll({
					where: { user_id: req.user.user_id, platform: 'mastodon' },
					order: [['display_name', 'ASC'], ['handle', 'ASC']]
				});
			}
		} catch (followsError) {
			console.error(new Date().toISOString(), 'Error fetching Mastodon follows:', followsError);
		}
		await ConnectedAccounts.upsert({
			user_id,
			platform: 'mastodon',
			handle: mastodonHandle,
			account_id: mastodonAccountId,
			access_token: tokenJson.access_token,
			refresh_token: '',
			instance_url: instance,
			extra: JSON.stringify({ instance })
		});
		//Add delay before fetching timeline to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 2000));
		let postsData = [];
		try {
			const config = {
				url: `${instance}/api/v1/timelines/home?limit=20`,
				headers: { Authorization: `Bearer ${tokenJson.access_token}` },
				mapper: mapMastodonToExternal,
				htmlGenerator: GenerateMastodonHTML,
				limit: 20,
				instance
			};
			const mappedPosts = await fetchAndProcessPosts('mastodon', config, user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			postsData = await Promise.all(
				mappedPosts.map(async (p) => {
					const formatted = formatExternalPost(p, FEED_CONFIG.mastodon, 'mastodon');
					formatted.content = await FEED_CONFIG.mastodon.generator(p.text_body, p.media);
					return formatted;
				})
			);
		} catch (timelineError) {
			console.error(new Date().toISOString(), 'Error fetching Mastodon timeline (connection still successful):', timelineError.message);
			//Connection succeeds even if timeline fetch fails due to rate limiting
		}
		//HTML to contain post data and follows
		res.send(`
			<!DOCTYPE html>
			<html>
			<body>
				<script>
					sessionStorage.setItem('mastodon_initial_posts', ${JSON.stringify(JSON.stringify(postsData))});
					localStorage.setItem('mastodonFollows', ${JSON.stringify(JSON.stringify(mastodonFollows))});
					window.location.href = '/feed/mastodon?connected=true';
				</script>
			</body>
			</html>
		`);
	} catch (error) {
		console.error(new Date().toISOString(), '/mastodon/callback error:', error);
		res.redirect('/feed/mastodon?error=1');
	}
});

//Combined route for Bluesky, Mastodon, and Reddit posts
router.get('/:platform/feed', authenticateCheck, async (req, res) => {
    const { platform } = req.params;
    if (!['bluesky', 'reddit', 'mastodon'].includes(platform)) {
        return res.status(404).json({ success: false, message: 'Invalid platform' });
    }
    try {
        const limit = Math.min(Number(req.query.limit) || 100, 100);
        const offset = Number(req.query.offset) || 0;
        const connectedAccount = await ConnectedAccounts.findOne({
            where: {
                user_id: req.user.user_id,
                platform: platform
            },
            attributes: ['platform', 'access_token', 'instance_url'],
            raw: true
        });
        const connectedAccounts = connectedAccount ? [connectedAccount] : []; //ApplyAlgorithm expects an array
		const algorithmResult = await ApplyAlgorithm({
			locationId: platform,
			userId: req.user.user_id,
			viewerId: req.session.viewer_id,
			limit,
			offset,
			connectedAccounts,
			isGroup: false
		});
		const items = algorithmResult.posts;
		const status = algorithmResult.status;
		const message = algorithmResult.message;
		//Check total posts available to determine hasMore
		const totalCount = await ExternalPostsAccess.count({
			where: { user_id: req.user.user_id, source: platform }
		});
		const hasMore = (offset + items.length) < totalCount;
        const extraPayload = platform === 'reddit' ? { after: null, before: null } : {};
        res.status(200).json({ success: true, items, status, message, hasMore, ...extraPayload });
    } catch (error) {
        console.error(new Date().toISOString(), `/${platform}/feed error:`, error);
        res.status(400).json({ success: false });
    }
});

router.get('/bluesky/follows', authenticateCheck, async (req, res) => {
	try {
		const blueskyFollows = await ExternalFollows.findAll({
			where: { user_id: req.user.user_id, platform: 'bluesky' },
			order: [['display_name', 'ASC'], ['handle', 'ASC']]
		});
		res.status(200).json({ success: true, blueskyFollows });
	} catch (error) {
		console.error(new Date().toISOString(), '/bluesky/follows error:', error);
		res.status(500).json({ success: false });
	}
});

router.get('/mastodon/follows', authenticateCheck, async (req, res) => {
	try {
		const mastodonFollows = await ExternalFollows.findAll({
			where: { user_id: req.user.user_id, platform: 'mastodon' },
			order: [['display_name', 'ASC'], ['handle', 'ASC']]
		});
		res.status(200).json({ success: true, mastodonFollows });
	} catch (error) {
		console.error(new Date().toISOString(), '/mastodon/follows error:', error);
		res.status(500).json({ success: false });
	}
});

//Route to get posts from a specific external account
//Frontend should pass handle and did as query params
router.get('/external/:platform/account/:accountId/posts', authenticateCheck, async (req, res) => {
	try {
		const { platform, accountId } = req.params;
		const { handle, did } = req.query;
		const limit = Math.min(Number(req.query.limit) || 50, 50);
		const offset = Number(req.query.offset) || 0;
		if (!['bluesky', 'mastodon'].includes(platform)) {
			return res.status(400).json({ success: false, message: `Platform ${platform} is not supported` });
		}
		//Get instance URL for Mastodon
		let instanceUrl = null;
		if (platform === 'mastodon') {
			const connectedAccount = await ConnectedAccounts.findOne({
				where: { user_id: req.user.user_id, platform: 'mastodon' },
				attributes: ['instance_url'],
				raw: true
			});
			instanceUrl = connectedAccount?.instance_url;
			if (!instanceUrl) {
				return res.status(400).json({ success: false, message: 'Mastodon instance not found' });
			}
		}
		//Use provided handle/did or fall back to accountId
		const authorHandle = handle || accountId;
		const authorDid = did || accountId;
		//Check how many posts we have in DB
		const dbPostCount = await ExternalPosts.count({
			where: {
				source: platform,
				[Op.or]: [
					{ author: authorHandle },
					{ author_did: authorDid },
					...(platform === 'mastodon' ? [{ author: accountId }] : [])
				]
			}
		});
		//If first page and insufficient posts, fetch from API
		if (offset === 0 && dbPostCount < limit) {
			await ensureExternalAccountPosts(req.user.user_id, platform, authorHandle, authorDid, null, instanceUrl);
		}
		//If we need more posts (paginating or not enough in DB), fetch from API
		if (offset + limit > dbPostCount) {
			const meta = await ExternalAccountMeta.findOne({
				where: {
					platform,
					[Op.or]: [{ account_id: authorDid }, { handle: authorHandle }]
				},
				attributes: ['cursor'],
				raw: true
			});
			if (meta?.cursor) {
				await ensureExternalAccountPosts(req.user.user_id, platform, authorHandle, authorDid, meta.cursor, instanceUrl);
			}
		}
		//Use ApplyAlgorithm for ranking
		const locationId = `external_account_${platform}_${authorDid}`;
		const algorithmResult = await ApplyAlgorithm({
			locationId,
			userId: req.user.user_id,
			viewerId: req.session.viewer_id,
			limit,
			offset,
			isGroup: false
		});
		//Determine hasMore
		const newDbCount = await ExternalPosts.count({
			where: {
				source: platform,
				[Op.or]: [
					{ author: authorHandle },
					{ author_did: authorDid },
					...(platform === 'mastodon' ? [{ author: accountId }] : [])
				]
			}
		});
		const meta = await ExternalAccountMeta.findOne({
			where: {
				platform,
				[Op.or]: [{ account_id: authorDid }, { handle: authorHandle }]
			},
			attributes: ['cursor'],
			raw: true
		});
		const hasMore = (offset + algorithmResult.posts.length) < newDbCount || !!meta?.cursor;
		res.status(200).json({
			success: true,
			items: algorithmResult.posts,
			hasMore,
			status: algorithmResult.status,
			message: algorithmResult.message
		});
	} catch (error) {
		console.error(new Date().toISOString(), '[ExternalAccountPosts] Route error:', error);
		res.status(500).json({ success: false, message: 'Error fetching account posts' });
	}
});

router.get('/connected-accounts', authenticateCheck, async (req, res) => {
	try {
		const accounts = await ConnectedAccounts.findAll({
			where: { user_id: req.user.user_id },
			attributes: ['platform', 'handle', 'instance_url', 'extra']
		});
		res.status(200).json({ success: true, accounts });
	} catch (error) {
		console.error(new Date().toISOString(), '/connected-accounts error:', error);
		res.status(500).json({ success: false });
	}
});

router.post('/disconnect_external_account', authenticateCheck, async (req, res) => {
	let transaction;
    try {
		transaction = await sequelize.transaction();
        const { platform } = req.body;
        if (!platform) {
            return res.status(400).json({ success: false, error: 'Missing platform' });
        }
        await ConnectedAccounts.destroy({ where: { user_id: req.user.user_id, platform }, transaction });
		await ExternalPostsAccess.destroy({ where: { user_id: req.user.user_id }, transaction });
		await PaginationTokens.destroy({ where: { user_id: req.user.user_id }, transaction });
		await transaction.commit();
        return res.status(200).json({ success: true });
    } catch (error) {
		if (transaction) await transaction.rollback();
        console.error(new Date().toISOString(), '/disconnect_external-account error:', error);
        res.status(500).json({ success: false });
    }
});

router.post('/reddit/expire', authenticateCheck, async (req, res) => {
	try {
		const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const accesses = await ExternalPostsAccess.findAll({
			where: { user_id: req.user.user_id },
			attributes: ['post_id']
		});
		const postIds = accesses.map(a => a.post_id).filter(Boolean);
		if (postIds.length) {
			await ExternalPosts.update(
				{ expired: true, title: null, text_body: null, media: null },
				{ where: { source: 'reddit', post_id: postIds, fetched_at: { [ExternalPosts.sequelize.Op.lt]: cutoff } } }
			);
		}
		res.status(200).json({ success: true });
	} catch (error) {
        console.error(new Date().toISOString(), '/reddit/expire error:', error);
		res.status(500).json({ success: false, error: 'Expire error' });
	}
});

//Vote/like on an external post
router.post('/vote_external_post', authenticateCheck, async (req, res) => {
	try {
		const { postId, voteType, source, sourcePostId } = req.body;
		const userId = req.user.user_id;
		if (!postId || !voteType || !source) {
			return res.status(400).json({ success: false, message: 'Missing required fields' });
		}
		//Get user's connected account for the platform
		const account = await ConnectedAccounts.findOne({
			where: { user_id: userId, platform: source.toLowerCase() }
		});
		if (!account) {
			return res.status(400).json({ success: false, message: `No ${source} account connected` });
		}
		//Check existing vote
		const existingVote = await ExternalPostVotes.findOne({
			where: { post_id: postId, user_id: userId }
		});
		let isRemoving = false;
		if (existingVote && existingVote.vote_type === voteType) {
			//User is removing their vote
			isRemoving = true;
		}
		let syncedToPlatform = false;
		let errorMessage = null;
		let platformUri = null;
		//Sync to platform APIs
		try {
			if (source.toLowerCase() === 'reddit') {
				//Reddit voting
				let dir = 0; //0 = unvote
				if (!isRemoving) {
					dir = voteType === 'upvote' ? 1 : -1;
				}
				const voteResponse = await fetch('https://oauth.reddit.com/api/vote', {
					method: 'POST',
					headers: {
						'Authorization': `bearer ${account.access_token}`,
						'User-Agent': ua(),
						'Content-Type': 'application/x-www-form-urlencoded'
					},
					body: new URLSearchParams({
						id: sourcePostId,
						dir: dir.toString()
					})
				});
				if (voteResponse.ok) {
					syncedToPlatform = true;
				} else {
					errorMessage = 'Failed to sync vote to Reddit';
				}
			} else if (source.toLowerCase() === 'bluesky') {
				//Bluesky like/unlike
				if (isRemoving) {
					//Unlike - need to find and delete the like record
					if (existingVote?.platform_uri) {
						const rkey = existingVote.platform_uri.split('/').pop();
						const unlikeResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
							method: 'POST',
							headers: {
								'Authorization': `Bearer ${account.access_token}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								repo: account.account_id,
								collection: 'app.bsky.feed.like',
								rkey: rkey
							})
						});
						syncedToPlatform = unlikeResponse.ok;
						if (!unlikeResponse.ok) {
							errorMessage = 'Failed to sync unlike to Bluesky';
						}
					} else {
						errorMessage = 'Like removed locally (was not synced to Bluesky)';
						syncedToPlatform = false;
					}
				} else {
					//Like - need to get the CID from the database
					const externalPost = await ExternalPosts.findOne({
						where: { post_id: postId },
						attributes: ['cid', 'source_post_id']
					});
					if (!externalPost?.cid) {
						errorMessage = 'Post CID not found - cannot sync like to Bluesky';
					} else {
						const likePayload = {
							repo: account.account_id,
							collection: 'app.bsky.feed.like',
							record: {
								subject: {
									uri: sourcePostId,
									cid: externalPost.cid
								},
								createdAt: new Date().toISOString()
							}
						};
						const likeResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
							method: 'POST',
							headers: {
								'Authorization': `Bearer ${account.access_token}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify(likePayload)
						});
						if (likeResponse.ok) {
							const likeData = await likeResponse.json();
							syncedToPlatform = true;
							//Store the like URI for future unlike operations
							platformUri = likeData.uri;
						} else {
							errorMessage = 'Failed to sync like to Bluesky';
						}
					}
				}
			} else if (source.toLowerCase() === 'mastodon') {
				//Mastodon favourite/unfavourite
				//For cross-instance posts, we need to find the local status ID
				let localStatusId = sourcePostId;
				//Get the post URL to check if it's from a different instance
				const externalPost = await ExternalPosts.findOne({
					where: { post_id: postId },
					attributes: ['url']
				});
				if (externalPost?.url) {
					const postUrl = externalPost.url;
					const postInstance = new URL(postUrl).origin;
					const userInstance = account.instance_url;
					//If post is from a different instance, search for local representation
					if (postInstance !== userInstance) {
						try {
							const searchResponse = await fetch(
								`${userInstance}/api/v2/search?${new URLSearchParams({
									q: postUrl,
									type: 'statuses',
									resolve: 'true',
									limit: '1'
								})}`,
								{
									headers: {
										'Authorization': `Bearer ${account.access_token}`
									}
								}
							);
							if (searchResponse.ok) {
								const searchData = await searchResponse.json();
								if (searchData.statuses && searchData.statuses.length > 0) {
									localStatusId = searchData.statuses[0].id;
								} else {
									errorMessage = 'Post not found on your Mastodon instance';
								}
							} else {
								errorMessage = 'Failed to find post on your instance';
							}
						} catch (searchError) {
							errorMessage = 'Failed to find post on your instance';
						}
					}
				}
				//Only proceed if we have a valid local status ID
				if (localStatusId && !errorMessage) {
					const endpoint = isRemoving ? 'unfavourite' : 'favourite';
					const mastodonResponse = await fetch(`${account.instance_url}/api/v1/statuses/${localStatusId}/${endpoint}`, {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${account.access_token}`
						}
					});
					if (mastodonResponse.ok) {
						syncedToPlatform = true;
					} else {
						errorMessage = 'Failed to sync like to Mastodon';
					}
				}
			}
		} catch (platformError) {
			errorMessage = `Failed to sync to ${source}`;
		}
		//Update database regardless of platform sync status
		const isVoteSystem = source.toLowerCase() === 'reddit'; //Reddit uses upvote/downvote, others use likes
		if (isRemoving) {
			await ExternalPostVotes.destroy({
				where: { post_id: postId, user_id: userId }
			});
			//Decrement score in external_posts
			const externalPost = await ExternalPosts.findOne({ where: { post_id: postId } });
			if (externalPost) {
				let delta = -1;
				if (isVoteSystem && existingVote?.vote_type === 'downvote') {
					delta = 1; //Removing downvote increases score
				}
				await ExternalPosts.update(
					{ score: sequelize.literal(`score + ${delta}`) },
					{ where: { post_id: postId } }
				);
			}
		} else {
			if (existingVote) {
				//Changing vote (e.g., upvote to downvote)
				const oldVoteType = existingVote.vote_type;
				existingVote.vote_type = voteType;
				existingVote.synced_to_platform = syncedToPlatform;
				if (platformUri) {
					existingVote.platform_uri = platformUri;
				}
				await existingVote.save();
				//Update score if vote type changed (only for Reddit)
				if (oldVoteType !== voteType && isVoteSystem) {
					let delta = 0;
					if (oldVoteType === 'downvote' && voteType === 'upvote') {
						delta = 2; //From -1 to +1
					} else if (oldVoteType === 'upvote' && voteType === 'downvote') {
						delta = -2; //From +1 to -1
					}
					if (delta !== 0) {
						await ExternalPosts.update(
							{ score: sequelize.literal(`score + ${delta}`) },
							{ where: { post_id: postId } }
						);
					}
				}
			} else {
				const newVote = {
					vote_id: v4(),
					post_id: postId,
					user_id: userId,
					source: source.toLowerCase(),
					vote_type: voteType,
					synced_to_platform: syncedToPlatform,
					platform_uri: platformUri
				};
				await ExternalPostVotes.create(newVote);
				//Increment score in external_posts
				const externalPost = await ExternalPosts.findOne({ where: { post_id: postId } });
				if (externalPost) {
					let delta = 1;
					if (isVoteSystem && voteType === 'downvote') {
						delta = -1;
					}
					await ExternalPosts.update(
						{ score: sequelize.literal(`score + ${delta}`) },
						{ where: { post_id: postId } }
					);
				}
			}
		}
		const responseData = {
			success: true,
			voteType: isRemoving ? null : voteType,
			syncedToPlatform,
			message: errorMessage || 'Vote recorded successfully'
		};
		res.status(200).json(responseData);
	} catch (error) {
		res.status(500).json({ success: false, message: 'Error recording vote' });
	}
});

//Get external posts for active users
if (process.env.NODE_ENV === 'production') { //No need to get posts in testing
	cron.schedule('*/10 * * * *', async () => { //Runs every 10 minutes
		try {
			console.log(new Date().toISOString(), 'Starting external posts update cron job');
			const batchSize = 100;
			//Only get users who were active in the last 10 minutes
			const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
			const activeUsers = await Users.findAll({
				where: { last_active_at: { [Op.gte]: tenMinutesAgo } },
				attributes: ['user_id'],
				order: [['last_active_at', 'ASC']],
				limit: batchSize
			});
			console.log(`Found ${activeUsers.length} active users`);
			for (const user of activeUsers) {
				const accounts = await ConnectedAccounts.findAll({
					where: { user_id: user.user_id }
				});
				for (const account of accounts) {
					await processAccount(account);
				}
			}
			console.log(new Date().toISOString(), 'Completed external posts update cron job');
		} catch (error) {
			console.error(new Date().toISOString(), 'Error updating external posts:', error);
		}
	});
	//Get external posts for admin user every hour
	cron.schedule('0 * * * *', async () => { //Runs every hour at minute 0
		try {
			const adminId = process.env.ADMIN_ID;
			if (!adminId) {
				console.log(new Date().toISOString(), 'ADMIN_ID not set, skipping admin external posts update');
				return;
			}
			console.log(new Date().toISOString(), 'Starting admin external posts update cron job');
			const adminUser = await Users.findOne({
				where: { user_id: adminId },
				attributes: ['user_id']
			});
			if (!adminUser) {
				console.log(new Date().toISOString(), `Admin user with ID ${adminId} not found`);
				return;
			}
			const accounts = await ConnectedAccounts.findAll({
				where: { user_id: adminUser.user_id }
			});
			console.log(`Found ${accounts.length} connected accounts for admin user`);
			for (const account of accounts) {
				await processAccount(account);
			}
			console.log(new Date().toISOString(), 'Completed admin external posts update cron job');
		} catch (error) {
			console.error(new Date().toISOString(), 'Error updating admin external posts:', error);
		}
	});
}

export default router;