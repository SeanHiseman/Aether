import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { computeHotness } from '../functions/postRanking.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import crypto from 'crypto';
import { ConnectedAccounts } from '../models/users.js';
import { ExternalPosts, ExternalPostsAccess } from '../models/content.js';
import express from 'express';
import fetch from 'node-fetch';
import { getEmbedder } from '../functions/contentAnalyser.js';
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

export function generateBlueskyContentHTML(textBody, media) {
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
		console.error('generateRedditContentHTML error:', error);
	}
}

export function generateMastodonContentHTML(htmlBody, media) {
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
		subreddit: null,
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
		subreddit: null,
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
	//Use snoovatar_img first, then author_icon_img, then a fallback default
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
		subreddit: d.subreddit || null,
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
		console.log('/connected-accounts error:', error);
		res.status(500).json({ success: false });
	}
});

router.post('/auth/bluesky', authenticateCheck, async (req, res) => {
	try {
		const { identifier, appPassword } = req.body;
		//Authenticate with Bluesky
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
		//Fetch initial posts
		const token = json.accessJwt;
		const limit = 100;
		const resp = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=${limit}`, {
			headers: { 
				'Authorization': `Bearer ${token}`, 
				'Content-Type': 'application/json' 
			}
		});
		if (resp.ok) {
			const j = await resp.json();
			const mappedPosts = j.feed.map(item => {
				const p = mapBlueskyToExternal(item);
				const rank_hotness = computeHotness({
					upvotes: p.score,
					downvotes: 0,
					createdAt: p.created_at_remote,
					referenceTime: Math.floor(Date.now() / 1000)
				});
				return { ...p, rank_hotness };
			});
			//Return posts immediately to frontend
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
			//Compute post data in background
			const start = Date.now();
			setImmediate(async () => {
				const embedder = await getEmbedder();
				const enrichedPosts = await Promise.all(mappedPosts.map(async (mapped) => {
					const html = generateBlueskyContentHTML(mapped.text_body, mapped.media);
					const details = await contentAnalyser.analyseContent(html, mapped.title, embedder);
					const sentiment_score = typeof details?.sentiment_score === 'number'
						? details.sentiment_score
						: 0;
					return { ...mapped, ...details, sentiment_score };
				}));
				//Avoid creating posts that already exist
				await ExternalPosts.bulkCreate(enrichedPosts, {
					updateOnDuplicate: [
						'title', 'text_body', 'media', 'score', 'replies', 'created_at_remote', 'fetched_at',
						'image_count', 'video_count', 'text_length', 'word_count', 'has_images', 'has_videos',
						'video_length', 'sentiment_score', 'tokens', 'embeddings', 'processed_at', 'rank_hotness'
					],
					ignoreDuplicates: true
				});
				const accessRows = enrichedPosts.map(p => ({
					id: v4(),
					post_id: p.post_id,
					source: 'bluesky',
					user_id: req.user.user_id,
					created_at: new Date()
				}));
				await ExternalPostsAccess.bulkCreate(accessRows, { 
					ignoreDuplicates: true 
				});
				console.log("Bluesky background processing:", Date.now() - start, "ms");
			});
		} else {
			//No posts available, but connection was successful
			res.status(200).json({ success: true, did: json.did, posts: [] });
		}
	} catch (error) {
		console.error('Error in /auth/bluesky:', error);
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
		console.error('Error in /auth/reddit:', error);
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
		console.log('Error in /auth/mastodon:', error);
		res.status(500).json({ success: false });
	}
});

router.get('/bluesky/feed', authenticateCheck, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 100, 100);
		const accesses = await ExternalPostsAccess.findAll({
			where: { user_id: req.user.user_id, source: 'bluesky' },
			attributes: ['post_id'],
			order: [['created_at','DESC']],
			limit
		});
		const postIds = accesses.map(a => a.post_id).filter(Boolean);
		if (!postIds.length) {
			return res.status(200).json({ success: true, items: [] });
		}
		const posts = await ExternalPosts.findAll({
			where: { post_id: postIds, source: 'bluesky' },
			order: [['rank_hotness','DESC']]
		});
		const items = posts.map(p => {
			const media = typeof p.media === 'string' ? JSON.parse(p.media) : p.media;
			const html = generateBlueskyContentHTML(p.text_body, media);
			return {
				post_id: p.post_id,
				title: p.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
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
					username: p.author || 'bluesky_user',
					user_photo: p.author_photo || '/media/site_images/default-bluesky-user-icon.png',
					profile_url: p.author ? `https://bsky.app/profile/${p.author}` : null
				},
				channel: p.channel,
				url: p.url,
				source: 'Bluesky',
				rank_hotness: p.rank_hotness
			};
		});
		res.status(200).json({ success: true, items });
	} catch (error) {
		console.error('Error in /bluesky/feed:', error);
		res.status(400).json({ success: false });
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
		await transaction.commit();
        return res.status(200).json({ success: true });
    } catch (error) {
		if (transaction) await transaction.rollback();
        console.log('/disconnect error:', error);
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
		//Fetch initial posts
		const token = tokenJson.access_token;
		const params = new URLSearchParams({ limit: '100' });
		const resp = await fetch(`https://oauth.reddit.com/best?${params.toString()}`, {
			headers: {
				'Authorization': `bearer ${token}`,
				'User-Agent': ua()
			}
		});
		//Return posts immediately
		if (resp.ok) {
			const j = await resp.json();
			const children = j.data.children.filter(c => c.kind === 't3');
			const mappedPosts = children.map(c => {
				const p = mapRedditToExternal(c);
				const rank_hotness = computeHotness({
					upvotes: p.score || 0,
					downvotes: 0,
					createdAt: p.created_at_remote,
					referenceTime: Math.floor(Date.now() / 1000)
				});
				return { ...p, rank_hotness };
			});
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
			//Small html file that contains post data
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
			//Background processing
			const start = Date.now();
			setImmediate(async () => {
				const embedder = await getEmbedder();
				const enriched = await Promise.all(mappedPosts.map(async mapped => {
					const html = generateRedditContentHTML(mapped.text_body, mapped.media);
					const details = await contentAnalyser.analyseContent(html, mapped.title, embedder);
					const rank_hotness = computeHotness({
						upvotes: mapped.score || 0,
						downvotes: 0,
						createdAt: mapped.created_at_remote,
						referenceTime: Math.floor(Date.now() / 1000)
					});
					const sentiment_score = details?.sentiment_score ?? 0;
					return { ...mapped, ...details, rank_hotness, sentiment_score };
				}));
				await ExternalPosts.bulkCreate(enriched, {
					updateOnDuplicate: [
						'title','text_body','media','score','replies','created_at_remote','fetched_at',
						'author_photo','image_count','video_count','text_length','word_count','has_images',
						'has_videos','video_length','sentiment_score','tokens','embeddings','processed_at',
						'rank_hotness'
					],
					ignoreDuplicates: true
				});
				await ExternalPostsAccess.bulkCreate(
					enriched.map(p => ({ id: v4(), post_id: p.post_id, source: 'reddit', user_id, created_at: new Date() })),
					{ ignoreDuplicates: true }
				);
				console.log("Reddit background processing:", Date.now() - start, "ms");
			});
		} else {
			res.redirect('/feed/reddit');
		}
	} catch (error) {
		console.error('reddit callback error', error);
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
		//Fetch initial posts
		const base = instance;
		const resp = await fetch(`${base}/api/v1/timelines/home?limit=40`, {
			headers: { Authorization: `Bearer ${tokenJson.access_token}` }
		});
		if (resp.ok) {
			const feed = await resp.json();
			const mappedPosts = feed.map(t => {
				const p = mapMastodonToExternal(t, instance);
				const rank_hotness = computeHotness({
					upvotes: p.score || 0,
					downvotes: 0,
					createdAt: p.created_at_remote,
					referenceTime: Math.floor(Date.now() / 1000)
				});
				return { ...p, rank_hotness };
			});
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
			//Small html file that contains post data
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
			//Background analysis
			const start = Date.now();
			setImmediate(async () => {
				const embedder = await getEmbedder();
				const enriched = await Promise.all(mappedPosts.map(async mapped => {
					const html = generateMastodonContentHTML(mapped.text_body, mapped.media);
					const details = await contentAnalyser.analyseContent(html, mapped.title, embedder);
					const rank_hotness = computeHotness({
						upvotes: mapped.score || 0,
						downvotes: 0,
						createdAt: mapped.created_at_remote,
						referenceTime: Math.floor(Date.now() / 1000)
					});
					const sentiment_score = details?.sentiment_score ?? 0;
					return { ...mapped, ...details, rank_hotness, sentiment_score };
				}));
				await ExternalPosts.bulkCreate(enriched, { updateOnDuplicate: [
					'text_body','media','score','replies','created_at_remote','fetched_at',
					'author_photo','image_count','video_count','text_length','word_count','has_images',
					'has_videos','video_length','sentiment_score','tokens','embeddings','processed_at',
					'rank_hotness'
				], ignoreDuplicates: true });
				await ExternalPostsAccess.bulkCreate(
					enriched.map(p => ({ id: v4(), post_id: p.post_id, source: 'mastodon', user_id, created_at: new Date() })),
					{ ignoreDuplicates: true }
				);
				console.log("Mastodon background processing:", Date.now() - start, "ms");
			});
		} else {
			res.redirect('/feed/mastodon');
		}
	} catch (error) {
		console.error(error);
		res.redirect('/feed/mastodon?error=1');
	}
});

router.get('/reddit/feed', authenticateCheck, async (req, res) => {
	try {
		const { limit = '100' } = req.query;
		const accesses = await ExternalPostsAccess.findAll({
			where: { user_id: req.user.user_id, source: 'reddit' },
			attributes: ['post_id']
		});
		const postIds = accesses.map(a => a.post_id).filter(Boolean);
		if (!postIds.length) {
			return res.status(200).json({ success: true, after: null, before: null, items: [] });
		}
		const posts = await ExternalPosts.findAll({
			where: { post_id: postIds, source: 'reddit' },
			order: [['rank_hotness','DESC']],
			limit: Math.min(Number(limit) || 100, 100)
		});
		const out = posts.map(p => {
			const media = typeof p.media === 'string' ? JSON.parse(p.media) : p.media;
			const contentHTML = generateRedditContentHTML(p.text_body, media);
			const username = (p.author || '').replace('u/','');
			return {
				post_id: p.post_id,
				title: p.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(contentHTML)}`,
				created_at: p.created_at_remote || new Date(),
				upvotes: p.score ?? 0,
				downvotes: 0,
				views: 0,
				replies: p.replies ?? 0,
				score: p.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					username: p.author || 'reddit_user',
					user_photo: p.author_photo || '/media/site_images/default-reddit-user-icon.png',
					profile_url: `https://www.reddit.com/user/${username}`
				},
				channel: p.subreddit || 'reddit',
				url: p.url,
				source: 'Reddit',
				rank_hotness: p.rank_hotness
			};
		});
		res.status(200).json({ success: true, after: null, before: null, items: out });
	} catch (error) {
		console.error('reddit feed error', error);
		res.status(400).json({ success: false });
	}
});

router.get('/mastodon/feed', authenticateCheck, async (req, res) => {
	try {
		console.log("getting mastodon feed for user:", req.user.user_id);
		const limit = Math.min(Number(req.query.limit) || 40, 40);
		console.log(`Mastodon feed request with limit: ${limit}`);
		const accesses = await ExternalPostsAccess.findAll({
			where: { user_id: req.user.user_id, source: 'mastodon' },
			attributes: ['post_id'],
			order: [['created_at','DESC']],
			limit
		});
		console.log(`Found ${accesses.length} mastodon accesses for user ${req.user.user_id}`);
		const postIds = accesses.map(a => a.post_id).filter(Boolean);
		if (!postIds.length) {
			return res.status(200).json({ success: true, items: [] });
		}
		console.log(`Fetching ${postIds.length} mastodon postIds`);
		console.log('Post IDs:', postIds);
		const posts = await ExternalPosts.findAll({
			where: { post_id: postIds, source: 'mastodon' },
			order: [['rank_hotness','DESC']]
		});
		console.log(`Found ${posts.length} mastodon posts for user ${req.user.user_id}`);
		const items = posts.map(p => {
			const media = typeof p.media === 'string' ? JSON.parse(p.media) : p.media;
			const html = generateMastodonContentHTML(p.text_body, media);
			return {
				post_id: p.post_id,
				title: null,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
				created_at: p.created_at_remote,
				upvotes: 0,
				downvotes: 0,
				views: 0,
				replies: p.replies,
				score: p.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					username: p.author,
					user_photo: p.author_photo,
					profile_url: p.url
				},
				channel: p.channel,
				url: p.url,
				source: 'Mastodon',
				rank_hotness: [p.rank_hotness]
			};
		});
		res.status(200).json({ success: true, items });
	} catch (error) {
		console.error('mastodon feed error', error);
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
        console.log("/reddit/expire error:", error);
		res.status(500).json({ success: false, error: 'Expire error' });
	}
});

export default router;