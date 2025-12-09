import authenticateCheck from '../functions/checks/authenticateCheck.js';
import cron from 'node-cron';
import { computeHotness } from '../functions/postRanking.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import crypto from 'crypto';
import { ConnectedAccounts, Users } from '../models/users.js';
import { ExternalPosts, ExternalPostsAccess, PaginationTokens } from '../models/content.js';
import express from 'express';
import fetch from 'node-fetch';
import { getEmbedder } from '../functions/contentAnalyser.js';
import { Op } from 'sequelize';
import sequelize from '../databaseSetup.js';
import { v4 } from 'uuid';

const contentAnalyser = new ContentAnalyser();
const router = express.Router();

const OAUTH_AUTHORIZE = 'https://www.reddit.com/api/v1/authorize';
const OAUTH_TOKEN = 'https://www.reddit.com/api/v1/access_token';
const OAUTH_ME = 'https://oauth.reddit.com/api/v1/me';

function ua() {
	if (process.env.NODE_ENV === 'production') {
		return 'AetherSocial/1.0 (+https://aethersocial.com)';
	}
	return 'AetherSocialLocal/0.1 (testing on localhost)';
}

async function fetchAndProcessPosts(platform, fetchConfig, user_id) {
	try {
		const { url, headers, mapper, htmlGenerator, limit } = fetchConfig;
		console.log("fetching posts for:", platform);
		const resp = await fetch(url, { headers });
		console.log("fetchAndProcessPosts response:", resp);
		const data = await resp.json();
		let mappedPosts = [];
		let nextToken = null;
		switch (platform) {
			case 'bluesky':
				if (!data || !data.feed) {
					return [];
				}
				mappedPosts = data.feed.map(item => {
					const p = mapper(item);
					const rank_hotness = computeHotness({
						upvotes: p.score,
						downvotes: 0,
						createdAt: p.created_at_remote,
						referenceTime: Math.floor(Date.now() / 1000)
					});
					return { ...p, rank_hotness };
				});
				{
					const localSeen = new Set();
					mappedPosts = mappedPosts.filter(p => {
						if (localSeen.has(p.post_id)) return false;
						localSeen.add(p.post_id);
						return true;
					});
				}
				nextToken = { cursor: data.cursor };
				break;
			case 'reddit':
				const children = data.data.children.filter(c => c.kind === 't3');
				mappedPosts = children.map(c => {
					const p = mapper(c);
					const rank_hotness = computeHotness({
						upvotes: p.score || 0,
						downvotes: 0,
						createdAt: p.created_at_remote,
						referenceTime: Math.floor(Date.now() / 1000)
					});
					return { ...p, rank_hotness };
				});
				{
					const localSeen = new Set();
					mappedPosts = mappedPosts.filter(p => {
						if (localSeen.has(p.post_id)) return false;
						localSeen.add(p.post_id);
						return true;
					});
				}
				nextToken = { after: data.data.after };
				break;
			case 'mastodon':
				mappedPosts = data.map(t => {
					const p = mapper(t, fetchConfig.instance);
					const rank_hotness = computeHotness({
						upvotes: p.score || 0,
						downvotes: 0,
						createdAt: p.created_at_remote,
						referenceTime: Math.floor(Date.now() / 1000)
					});
					return { ...p, rank_hotness };
				});
				{
					const localSeen = new Set();
					mappedPosts = mappedPosts.filter(p => {
						if (localSeen.has(p.post_id)) return false;
						localSeen.add(p.post_id);
						return true;
					});
				}
				if (mappedPosts.length > 0) {
					nextToken = { max_id: mappedPosts[mappedPosts.length - 1].source_post_id };
				}
				break;
		}
		const existing = await ExternalPosts.findAll({
			where: { post_id: mappedPosts.map(m => m.post_id) },
			attributes: ['post_id']
		});
		const existingIds = new Set(existing.map(e => e.post_id));
		const newPosts = mappedPosts.filter(p => !existingIds.has(p.post_id));
		console.log("fetchAndProcessPosts newPosts.length:", newPosts.length);
		const existingToken = await PaginationTokens.findOne({
            where: { user_id, platform }
        });
        const tokenId = existingToken?.id || v4();
		console.log("tokenId:", tokenId);
        if (newPosts.length === 0) {
            if (nextToken) {
                await PaginationTokens.upsert({
                    id: tokenId,
                    user_id,
                    platform,
                    ...nextToken,
                    updated_at: new Date()
                });
            }
            return newPosts;
        }
		const embedder = await getEmbedder();
		const enriched = await Promise.all(newPosts.map(async mapped => {
			const html = htmlGenerator(mapped.text_body, mapped.media);
			const details = await contentAnalyser.analyseContent(html, mapped.title, embedder);
			const sentiment_score = details?.sentiment_score ?? 0;
			const embeddings = details?.embeddings ?? null;
			const has_text = (mapped.text_body?.length || 0) > 0;
			const post = {
				post_id: mapped.post_id,
				source: mapped.source,
				source_post_id: mapped.source_post_id,
				title: mapped.title || null,
				text_body: mapped.text_body || null,
				text_length: mapped.text_length || 0,
				word_count: mapped.word_count || 0,
				image_count: mapped.image_count || 0,
				video_count: mapped.video_count || 0,
				has_text,
				has_images: mapped.has_images || false,
				has_videos: mapped.has_videos || false,
				score: mapped.score || 0,
				replies: mapped.replies || 0,
				rank_hotness: mapped.rank_hotness || 0,
				sentiment_score,
				embeddings,
				fetched_at: mapped.fetched_at,
				created_at_remote: mapped.created_at_remote,
				expired: mapped.expired || false,
				channel: mapped.channel || null,
				author: mapped.author || null,
				author_photo: mapped.author_photo || null,
				url: mapped.url,
				media: mapped.media
			};
			return post;
		}));
		console.log("enriched.length:", enriched.length);
		const updateFields = [
			'source_post_id', 'title', 'text_body', 'text_length', 'word_count', 
			'image_count', 'video_count', 'has_text', 'has_images', 'has_videos',
			'score', 'replies', 'rank_hotness', 'sentiment_score', 'embeddings',
			'fetched_at', 'created_at_remote', 'expired', 'channel', 'author',
			'author_photo', 'url', 'media'
		];
		try {
			await ExternalPosts.bulkCreate(enriched, {
				updateOnDuplicate: updateFields,
				logging: false
			});
		} catch (error) {
			console.log("error creating external posts for", platform, error);
		}
		//dedupe before creating access rows
		const accessSeen = new Set();
		const accessRows = enriched.filter(p => {
			if (accessSeen.has(p.post_id)) return false;
			accessSeen.add(p.post_id);
			return true;
		}).map(p => ({
			id: v4(),
			post_id: p.post_id,
			source: platform,
			user_id,
			rank_hotness: p.rank_hotness,
			created_at: new Date()
		}));
		try {
			await ExternalPostsAccess.bulkCreate(accessRows, { ignoreDuplicates: true });
		} catch (error) {
			console.log("error creating external posts for", platform, error);
		}
		if (nextToken) {
			await PaginationTokens.upsert({
				id: v4(),
				user_id,
				platform,
				...nextToken,
				updated_at: new Date()
			});
		}
		return newPosts;
	} catch (error) {
		console.error(new Date().toISOString(), `fetchAndProcessPosts ${platform} error:`, error);
		throw error;
	}
}

export async function processAccount(account) {
	try {
		const { access_token, instance_url, platform, user_id } = account;
		console.log("account:", account);
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
				htmlGenerator: generateBlueskyContentHTML,
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
				htmlGenerator: generateRedditContentHTML,
				limit: 100
			},
			mastodon: {
				url: paginationToken?.max_id 
					? `${instance_url}/api/v1/timelines/home?limit=40&max_id=${paginationToken.max_id}`
					: `${instance_url}/api/v1/timelines/home?limit=40`,
				headers: { Authorization: `Bearer ${access_token}` },
				mapper: mapMastodonToExternal,
				htmlGenerator: generateMastodonContentHTML,
				limit: 40,
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

export function generateBlueskyContentHTML(textBody, media) {
	try {
		let html = '';
		if (textBody?.trim()) {
			html += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					<p>${textBody
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/\n/g, '<br>')}
					</p>
				</div>
			`;
		}
		if (Array.isArray(media)) {
			for (const m of media) {
				if (!m.url) continue;
				html += `
					<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
						${m.url.match(/\\.(mp4|webm|mov|m4v)$/i)
							? `<video src="${m.url}" controls playsinline></video>`
							: `<img src="${m.url}" alt="Bluesky media" />`}
					</div>
				`;
			}
		}
		return html.trim();
	} catch (error) {
		console.error(new Date().toISOString(), 'generateBlueskyContentHTML error:', error);
	}
}

export function generateRedditContentHTML(textBody, mediaArray) {
	try {
		const mediaItems = Array.isArray(mediaArray)
			? mediaArray
			: mediaArray
				? [mediaArray]
				: [];
		let html = '';
		if (textBody && textBody.trim()) {
			html += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					<p>${textBody
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/\n/g, '<br>')}
					</p>
				</div>
			`;
		}
		for (const media of mediaItems) {
			const url = media?.source?.url?.replace(/&amp;/g, '&');
			if (!url) continue;
			html += `
				<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
					<img src="${url}" alt="Reddit media" />
				</div>
			`;
		}
		return html.trim();
	} catch (error) {
		console.error(new Date().toISOString(), 'generateRedditContentHTML error:', error);
	}
}

export function generateMastodonContentHTML(htmlBody, media) {
	try {
		let out = '';
		if (htmlBody) {
			out += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					${htmlBody}
				</div>
			`;
		}
		if (Array.isArray(media)) {
			for (const m of media) {
				if (!m.url) continue;
				out += `
					<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
							<img src="${m.url}" alt="Mastodon media" />
					</div>
				`;
			}
		}
		return out.trim();
	} catch (error) {
		console.error(new Date().toISOString(), 'generateMastodonContentHTML error:', error)
	}
}

function mapBlueskyToExternal(item) {
	const post = item.post;
	const record = post.record || {};
	const text = record.text || '';
	let images = null;
	let videos = null;
	if (post.embed && post.embed.images) {
		images = post.embed.images.map(img => ({ url: img.fullsize || img.thumb || null }));
	}
	if (post.embed && post.embed.$type === 'app.bsky.embed.video') {
		videos = [{ url: post.embed.video?.playlist || null }];
	}
	if (post.embed && post.embed.$type === 'app.bsky.embed.external') {
		const uri = post.embed.external?.uri || '';
		if (uri.match(/\.(mp4|webm|mov|m4v)$/i)) {
			videos = [{ url: uri }];
		}
	}
	const media = [
		...(Array.isArray(images) ? images : []),
		...(Array.isArray(videos) ? videos : [])
	];
	return {
		post_id: `bluesky:${post.uri}`,
		author: post.author?.handle || null,
		author_photo: post.author?.avatar || null,
		created_at_remote: new Date(record.createdAt),
		expired: false,
		fetched_at: new Date(),
		media,
		score: typeof post.likeCount === 'number' ? post.likeCount : 0,
		replies: typeof post.replyCount === 'number' ? post.replyCount : 0,
		source: 'bluesky',
		source_post_id: post.uri,
		text_body: text,
		title: null,
		url: `https://bsky.app/profile/${post.author?.handle}/post/${post.uri.split('/').pop()}`,
		text_length: text.length,
		word_count: text ? text.split(/\s+/).length : 0,
		image_count: Array.isArray(images) ? images.length : 0,
		video_count: Array.isArray(videos) ? videos.length : 0,
		has_images: Array.isArray(images) && images.length > 0,
		has_videos: Array.isArray(videos) && videos.length > 0,
		channel: post.author?.handle || null
	};
}

function mapMastodonToExternal(toot, instance) {
	const text = toot.content || '';
	const media = Array.isArray(toot.media_attachments)
		? toot.media_attachments.map(m => ({ url: m.url }))
		: null;
	return {
		post_id: `mastodon:${toot.id}`,
		author: toot.account?.acct || null,
		author_photo: toot.account?.avatar || null,
		created_at_remote: new Date(toot.created_at),
		expired: false,
		fetched_at: new Date(),
		media,
		score: typeof toot.favourites_count === 'number' ? toot.favourites_count : 0,
		replies: toot.replies_count ?? 0,
		source: 'mastodon',
		source_post_id: toot.id,
		text_body: toot.content || '',
		title: null,
		url: toot.url || null,
		text_length: text.length,
		word_count: text ? text.replace(/<[^>]*>/g, '').split(/\s+/).length : 0,
		image_count: Array.isArray(media) ? media.filter(m => m && m.url && (!m.type || m.type !== 'video')).length : 0,
		video_count: Array.isArray(media) ? media.filter(m => m && m.type === 'video').length : 0,
		has_images: Array.isArray(media) && media.length > 0,
		has_videos: false,
		channel: instance
	};
} 

function mapRedditToExternal(child) {
	const d = child.data;
	let media = null;
	if (d.is_gallery && d.gallery_data && d.media_metadata) {
		media = d.gallery_data.items.map(item => {
			const meta = d.media_metadata[item.media_id];
			const src = meta?.s?.u || meta?.s?.gif || meta?.s?.mp4 || null;
			return src ? { source: { url: src } } : null;
		}).filter(Boolean);
	} else if (d.preview?.images) {
		media = d.preview.images;
	}
	const authorPhoto = 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_0.png';
	return {
		post_id: `reddit:${d.id}`,
		author: d.author ? `u/${d.author}` : null,
		author_photo: authorPhoto,
		created_at_remote: new Date(d.created_utc * 1000),
		expired: false,
		fetched_at: new Date(),
		media,
		score: typeof d.score === 'number' ? d.score : null,
		replies: typeof d.num_comments === 'number' ? d.num_comments : 0,
		source: 'reddit',
		source_post_id: d.id,
		text_body: d.selftext || null,
		title: d.title || null,
		url: `https://www.reddit.com${d.permalink}`, 
		text_length: d.selftext?.length || 0,
		word_count: d.selftext ? d.selftext.split(/\s+/).length : 0,
		image_count: Array.isArray(media) ? media.length : 0,
		video_count: d.media?.reddit_video ? 1 : 0,
		has_images: !!media,
		has_videos: !!d.media?.reddit_video,
		channel: d.subreddit || null,
	};
}

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

router.post('/auth/bluesky', authenticateCheck, async (req, res) => {
	try {
		const { identifier, appPassword } = req.body;
		const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ identifier, password: appPassword })
		});
		if (!response.ok) {
			return res.status(400).json({ success: false, message: 'Invalid handle or app password'});
		}
		const json = await response.json();
		await ConnectedAccounts.upsert({
			user_id: req.user.user_id,
			platform: 'bluesky',
			handle: identifier,
			instance_url: 'https://bsky.social',
			access_token: json.accessJwt,
			refresh_token: json.refreshJwt,
			extra: JSON.stringify(json)
		});
		const config = {
			url: `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=100`,
			headers: { 
				'Authorization': `Bearer ${json.accessJwt}`, 
				'Content-Type': 'application/json' 
			},
			mapper: mapBlueskyToExternal,
			htmlGenerator: generateBlueskyContentHTML,
			limit: 100
		};
		try {
			const mappedPosts = await fetchAndProcessPosts('bluesky', config, req.user.user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			//Return posts immediately
			res.status(200).json({ 
				success: true,
				did: json.did,
				posts: mappedPosts.map(p => ({
					post_id: p.post_id,
					title: p.title,
					content: `data:text/html;charset=utf-8,${encodeURIComponent(generateBlueskyContentHTML(p.text_body, p.media))}`,
					created_at: p.created_at_remote,
					upvotes: 0,
					downvotes: 0,
					views: 0,
					replies: p.replies ?? 0,
					score: p.score || 0,
					is_saved: false,
					has_upvoted: false,
					has_downvoted: false,
					poster: {
						profile_url: p.author ? `https://bsky.app/profile/${p.author}` : null,
						user_photo: p.author_photo || '/media/site_images/default-bluesky-user-icon.png',
						username: p.author || 'bluesky_user'
					},
					channel: p.channel,
					url: p.url,
					source: 'Bluesky',
					rank_hotness: p.rank_hotness
				}))
			});
		} catch (fetchError) {
			res.status(200).json({ success: true, did: json.did, posts: [] });
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
				scopes: "read follow",
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
			scope: 'read follow',
			state: JSON.stringify({ instance, user_id: req.user.user_id })
		});
		res.status(200).json({ success: true, url: `${base}/oauth/authorize?${params.toString()}` });
	} catch (error) {
		console.error(new Date().toISOString(), '/auth/mastodon error:', error);
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

router.get('/reddit/callback', authenticateCheck, async (req, res) => {
	try {
		const code = req.query.code;
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
			htmlGenerator: generateRedditContentHTML,
			limit: 100
		};
		try {
			const mappedPosts = await fetchAndProcessPosts('reddit', config, user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			const postsData = mappedPosts.map(p => ({
				post_id: p.post_id,
				title: p.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(generateRedditContentHTML(p.text_body, p.media))}`,
				created_at: p.created_at_remote,
				upvotes: 0,
				downvotes: 0,
				views: 0,
				replies: p.replies ?? 0,
				score: p.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					profile_url: p.author ? `https://reddit.com/${p.author}` : null,
					user_photo: p.author_photo || '/media/site_images/default-reddit-user-icon.png',
					username: p.author || 'reddit_user'
				},
				channel: p.channel,
				url: p.url,
				source: 'Reddit',
				rank_hotness: p.rank_hotness
			}));
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
		await ConnectedAccounts.upsert({
			user_id,
			platform: 'mastodon',
			handle: null,
			access_token: tokenJson.access_token,
			refresh_token: '',
			instance_url: instance,
			extra: JSON.stringify({ instance })
		});
		const config = {
			url: `${instance}/api/v1/timelines/home?limit=40`,
			headers: { Authorization: `Bearer ${tokenJson.access_token}` },
			mapper: mapMastodonToExternal,
			htmlGenerator: generateMastodonContentHTML,
			limit: 40,
			instance
		};
		try {
			const mappedPosts = await fetchAndProcessPosts('mastodon', config, user_id);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			const postsData = mappedPosts.map(p => ({
				post_id: p.post_id,
				title: p.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(generateMastodonContentHTML(p.text_body, p.media))}`,
				created_at: p.created_at_remote,
				upvotes: 0,
				downvotes: 0,
				views: 0,
				replies: p.replies ?? 0,
				score: p.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					profile_url: p.author ? `${instance}/@${p.author}` : null,
					user_photo: p.author_photo || '/media/site_images/default-mastodon-user-icon.png',
					username: p.author || 'mastodon_user'
				},
				channel: p.channel,
				url: p.url,
				source: 'Mastodon',
				rank_hotness: p.rank_hotness
			}));
			//HTML to contain post data
			res.send(`
				<!DOCTYPE html>
				<html>
				<body>
					<script>
						sessionStorage.setItem('mastodon_initial_posts', ${JSON.stringify(JSON.stringify(postsData))});
						window.location.href = '/feed/mastodon?connected=true';
					</script>
				</body>
				</html>
			`);
		} catch (fetchError) {
			res.redirect('/feed/mastodon');
		}
	} catch (error) {
		console.error(new Date().toISOString(), '/mastodon/callback error:', error);
		res.redirect('/feed/mastodon?error=1');
	}
});

const FEED_CONFIG = {
    bluesky: {
        generator: generateBlueskyContentHTML,
        defaultIcon: '/media/site_images/default-bluesky-user-icon.png',
        sourceName: 'Bluesky',
        getProfileUrl: (p) => p.author ? `https://bsky.app/profile/${p.author}` : null,
        getChannel: (p) => p.channel,
        mapExtras: (p) => ({ title: p.title }) //Bluesky uses title
    },
    reddit: {
        generator: generateRedditContentHTML,
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
        generator: generateMastodonContentHTML,
        defaultIcon: null, //Add default if you have one, or handle logic below
        sourceName: 'Mastodon',
        getProfileUrl: (p) => p.url,
        getChannel: (p) => p.channel,
        mapExtras: (p) => ({ 
            title: null, //Mastodon usually has no title
            rank_hotness: [p.rank_hotness] //Preserving your original array format
        })
    }
};

//Combined route for Bluesky, Mastodon, and Reddit posts
router.get('/:platform/feed', authenticateCheck, async (req, res) => {
    const { platform } = req.params;
    //Allowed platforms
    if (!['bluesky', 'reddit', 'mastodon'].includes(platform)) {
        return res.status(404).json({ success: false, message: 'Invalid platform' });
    }
    const config = FEED_CONFIG[platform];
    try {
        const limit = Math.min(Number(req.query.limit) || 100, 100);
        const offset = Number(req.query.offset) || 0;
        let accesses = await ExternalPostsAccess.findAll({
            where: { user_id: req.user.user_id, source: platform },
            attributes: ['post_id'],
            order: [['rank_hotness', 'DESC']],
            limit,
            offset
        });
        //Refresh logic: If no local posts, fetch from remote API
        if (!accesses.length) {
            console.log(`getting external posts in /${platform}/feed`);
            const account = await ConnectedAccounts.findOne({
                where: { user_id: req.user.user_id, platform: platform }
            });
            if (account) {
                console.log(`${platform} account found, getting posts`);
                //Trigger background/process logic
                await processAccount({
                    platform: platform,
                    user_id: req.user.user_id,
                    access_token: account.access_token,
                    instance_url: account.instance_url
                });
                //Re-fetch accesses after refresh
                try {
                    console.log(`getting ${platform} accesses`);
                    accesses = await ExternalPostsAccess.findAll({
                        where: { user_id: req.user.user_id, source: platform },
                        attributes: ['post_id'],
                        order: [['rank_hotness', 'DESC']],
                        limit,
                        offset
                    });
                } catch (error) {
                    console.log(`${platform} accesses error:`, error);
                }
                console.log(`${platform} accesses.length after refresh:`, accesses.length);
            }
        }
        const postIds = accesses.map(a => a.post_id).filter(Boolean);
        console.log(`${platform} postIds.length:`, postIds.length);
        if (!postIds.length) {
            const extraPayload = platform === 'reddit' ? { after: null, before: null } : {};
            return res.status(200).json({ success: true, items: [], ...extraPayload });
        }
        const posts = await ExternalPosts.findAll({
            where: { post_id: postIds, source: platform },
            order: [['rank_hotness', 'DESC']]
        });
        const items = posts.map(p => {
            const media = typeof p.media === 'string' ? JSON.parse(p.media) : p.media;
            const html = config.generator(p.text_body, media);
            const extras = config.mapExtras ? config.mapExtras(p) : {};
            return {
                post_id: p.post_id,
                content: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
                created_at: p.created_at_remote || new Date(),
                upvotes: 0,
                downvotes: 0,
                views: 0,
                replies: p.replies ?? 0,
                score: p.score || 0,
                is_saved: false,
                has_upvoted: false,
                has_downvoted: false,
                poster: {
                    username: p.author || `${platform}_user`,
                    user_photo: p.author_photo || config.defaultIcon,
                    profile_url: config.getProfileUrl(p)
                },
                channel: config.getChannel(p),
                url: p.url,
                source: config.sourceName,
                rank_hotness: p.rank_hotness,
                ...extras
            };
        });
        const extraPayload = platform === 'reddit' ? { after: null, before: null } : {};
        res.status(200).json({ success: true, items, ...extraPayload });
    } catch (error) {
        console.error(new Date().toISOString(), `/${platform}/feed error:`, error);
        res.status(400).json({ success: false });
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

//Get external posts for active users
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

export default router;