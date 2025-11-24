import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import crypto from 'crypto';
import { ConnectedAccounts } from '../models/users.js';
import { ExternalPosts, ExternalPostsAccess } from '../models/content.js';
import express from 'express';
import fetch from 'node-fetch';
import { computeHotness } from '../functions/postRanking.js';
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

async function ensureRedditAccessToken(account) {
	try {
		if (account.expires_at > new Date(Date.now() + 60 * 1000)) return account.access_token;
		if (!account.refresh_token) return account.access_token;
		const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
		const response = await fetch(OAUTH_TOKEN, {
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': ua()
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: account.refresh_token
			})
		});
		if (!response.ok) return account.access_token;
		const json = await response.json();
		account.access_token = json.access_token;
		account.expires_at = new Date(Date.now() + (json.expires_in * 1000));
		await account.save();
		return account.access_token;
	} catch (error) {
		console.error('ensureRedditAccessToken error:', error);
	}
}

function decodeBlueskyJwt(jwt) {
	const body = jwt.split('.')[1];
	return JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
}

async function ensureBlueskyToken(account) {
	try {
		const decoded = decodeBlueskyJwt(account.access_token);
		if (!decoded.scope || !decoded.scope.includes('app.bsky.feed.read')) {
			const session = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifier: account.handle,
					password: account.extra?.appPassword
				})
			});
			if (session.ok) {
				const json = await session.json();
				account.access_token = json.accessJwt;
				account.refresh_token = json.refreshJwt;
				account.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
				await account.save();
				return account.access_token;
			}
		}
		if (account.expires_at > new Date(Date.now() + 60 * 1000)) {
			return account.access_token;
		}
		const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${account.refresh_token}`,
				'Content-Type': 'application/json'
			}
		});
		if (!response.ok) return account.access_token;
		const json = await response.json();
		account.access_token = json.accessJwt;
		account.refresh_token = json.refreshJwt;
		account.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
		await account.save();
		return account.access_token;
	} catch (error) {
		console.error('ensureBlueskyToken error:', error);
		return account.access_token;
	}
}

async function ensureMastodonToken(account) {
     return account.access_token;
} 

async function fetchRedditUserProfile(username, token) {
	const resp = await fetch(`https://oauth.reddit.com/user/${username}/about`, {
		headers: {
			'Authorization': `bearer ${token}`,
			'User-Agent': ua()
		}
	});
	if (!resp.ok) return null;
	const data = await resp.json();
	return data.data?.icon_img || null;
}

function generateBlueskyContentHTML(textBody, media) {
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

function generateRedditContentHTML(textBody, mediaArray) {
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

function generateMastodonContentHTML(htmlBody, media) {
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
		author_photo: post.author?.did
			? `https://cdn.bsky.app/img/avatar/plain/${post.author.did}/avatar`
			: null,
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
	return {
		post_id: `reddit:${d.id}`,
		author: d.author ? `u/${d.author}` : null,
		author_photo: null,
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
		url: d.url_overridden_by_dest || `https://www.reddit.com${d.permalink}`,
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
		if (!identifier || !appPassword) {
			return res.status(400).json({ success: false, error: 'Missing credentials' });
		}
		const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				identifier,
				password: appPassword
			})
		});
		if (!response.ok) return res.status(401).json({ success: false, error: 'Invalid Bluesky login' });
		const json = await response.json();
		await ConnectedAccounts.upsert({
			user_id: req.user.user_id,
			platform: 'bluesky',
			handle: json.handle,
			access_token: json.accessJwt,
			refresh_token: json.refreshJwt,
			expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
			extra: { did: json.did, appPassword }
		});
		res.status(200).json({ success: true });
	} catch (error) {
		console.log('/auth/bluesky error:', error);
		res.status(500).json({ success: false });
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
		req.session.reddit_oauth_nonce = statePayload.nonce;;
        const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
        const scope = ['identity','read','mysubreddits','history'].join(' ');
        const url = `${OAUTH_AUTHORIZE}?client_id=${encodeURIComponent(REDDIT_CLIENT_ID)}&response_type=code&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDDIT_REDIRECT_URI)}&duration=permanent&scope=${encodeURIComponent(scope)}`;
        res.redirect(url);
    } catch (error) {
      	console.error('/auth/reddit error:', error);
		res.status(500).send('Reddit auth setup failed');  
    }
});

router.post('/auth/mastodon', authenticateCheck, async (req, res) => {
	try {
		const { instance } = req.body;
		console.log("Requested Mastodon instance:", instance);
		if (!instance) return res.status(400).json({ success: false, error: 'Missing instance' });
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
		console.log("Register response:", registerResponse);
		const app = await registerResponse.json();
		if (!registerResponse.ok || !app.client_id) {
			return res.status(500).json({ success: false, error: 'App registration failed' });
		}
		await ConnectedAccounts.upsert({
			id: v4(),
			user_id: req.user.user_id,
			platform: 'mastodon',
			access_token: null,
			refresh_token: null,
			expires_at: null,
			extra: {
				instance,
				client_id: app.client_id,
				client_secret: app.client_secret
			}
		});
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: app.client_id,
			redirect_uri: process.env.MASTODON_REDIRECT_URI,
			scope: 'read follow',
			state: JSON.stringify({ instance, user_id: req.user.user_id })
		});
		console.log("Mastodon params:", params);
		res.status(200).json({ success: true, url: `${base}/oauth/authorize?${params.toString()}` });
	} catch (error) {
		console.log('/auth/mastodon error:', error);
		res.status(500).json({ success: false });
	}
});

router.get('/bluesky/feed', authenticateCheck, async (req, res) => {
	try {
		const account = await ConnectedAccounts.findOne({
			where: { user_id: req.user.user_id, platform: 'bluesky' }
		});
		if (!account) {
			return res.status(404).json({ success: false, error: 'Not connected' });
		}
		const token = await ensureBlueskyToken(account);
		const extra = typeof account.extra === 'string' ? JSON.parse(account.extra) : account.extra;
		const did = extra?.did;
		if (!did) return res.status(500).json({ success: false, error: 'No DID stored' });
		const limit = Math.min(Number(req.query.limit) || 50, 100);
		const response = await fetch(
			`https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=${limit}`,
			{
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			}
		);
		if (!response.ok) return res.status(502).json({ success: false, error: 'Upstream error' });
		const json = await response.json();
		const items = json.feed.map(item => {
			const mapped = mapBlueskyToExternal(item);
			const html = generateBlueskyContentHTML(mapped.text_body, mapped.media);
			return {
				post_id: mapped.post_id,
				title: mapped.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
				created_at: mapped.created_at_remote,
				upvotes: 0,
				downvotes: 0,
				views: 0,
				replies: typeof mapped.replies === 'number' ? mapped.replies : 0,
				score: mapped.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					username: mapped.author || 'bluesky_user',
					user_photo: item.post.author?.avatar || '/media/site_images/default-bluesky-user-icon.png',
					profile_url: mapped.author
						? `https://bsky.app/profile/${mapped.author}`
						: null
				},
				channel: mapped.channel,
				url: mapped.url,
				source: 'Bluesky',
				rank_hotness: computeHotness({
					upvotes: mapped.score ?? 0,
					downvotes: 0,
					createdAt: mapped.created_at_remote,
					referenceTime: Date.now()
				})
			};
		});
		const mappedPosts = json.feed.map(item => mapBlueskyToExternal(item));
		await ExternalPosts.bulkCreate(mappedPosts, {
			updateOnDuplicate: [
				'title',
				'text_body',
				'media',
				'score',
				'replies',
				'created_at_remote',
				'fetched_at',
				'image_count',
				'video_count'
			],
			ignoreDuplicates: true
		});
		const accessRows = mappedPosts.map(p => ({
			id: v4(),
			post_id: p.post_id,
			user_id: req.user.user_id,
			created_at: new Date()
		}));
		if (accessRows.length) {
			await ExternalPostsAccess.bulkCreate(accessRows, { ignoreDuplicates: true });
		}
		res.status(200).json({ success: true, items });
		//Background embedding generation
		(async () => {
			for (const p of mappedPosts) {
				const exists = await ExternalPosts.findOne({
					where: { post_id: p.post_id },
					attributes: ['embeddings']
				});
				const source = `${p.title || ''} ${p.text_body || ''}`.trim();
				if (source && (!exists || !exists.embeddings)) {
					const emb = await contentAnalyser.generateEmbedding(source);
					const sentiment = await contentAnalyser.calculateSentiment(source);
					await ExternalPosts.update(
						{ embeddings: JSON.stringify(emb), sentiment_score: sentiment },
						{ where: { post_id: p.post_id } }
					);
				}
			}
		})();
	} catch (error) {
		console.log('/bluesky/feed error:', error);
		res.status(500).json({ success: false });
	}
});

router.post('/disconnect_external_account', authenticateCheck, async (req, res) => {
    try {
        const { platform } = req.body;
        if (!platform) {
            return res.status(400).json({ success: false, error: 'Missing platform' });
        }
        await ConnectedAccounts.destroy({
            where: { user_id: req.user.user_id, platform }
        });
		await ExternalPostsAccess.destroy({ where: { user_id: req.user.user_id }, transaction });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.log('/disconnect error:', error);
        res.status(500).json({ success: false });
    }
});

router.get('/reddit/callback', authenticateCheck, async (req, res) => {
	try {
		const { code, state } = req.query;
		const payload = JSON.parse(Buffer.from(state, 'base64url').toString());
		const { user_id, nonce } = payload;
		const savedNonce = req.session.reddit_oauth_nonce;
		if (!savedNonce || nonce !== savedNonce) {
			return res.status(400).send('Invalid state');
		}
		delete req.session.reddit_oauth_nonce;
		const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URI, FRONTEND_URL } = process.env;
		const tokenResp = await fetch(OAUTH_TOKEN, {
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': ua()
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: REDDIT_REDIRECT_URI
			})
		});
		if (!tokenResp.ok) return res.status(502).send('Token exchange failed');
		const tokenJson = await tokenResp.json();
		const meResp = await fetch(OAUTH_ME, {
			headers: {
				'Authorization': `bearer ${tokenJson.access_token}`,
				'User-Agent': ua()
			}
		});
		if (!meResp.ok) return res.status(502).send('Identity fetch failed');
		const me = await meResp.json();
		const expiresAt = new Date(Date.now() + (tokenJson.expires_in * 1000));
        await ConnectedAccounts.upsert({
			id: v4(),
            user_id,
            platform: 'reddit',
            handle: `u/${me.name}`,
            access_token: tokenJson.access_token,
            refresh_token: tokenJson.refresh_token || null,
            token_type: tokenJson.token_type,
            scope: tokenJson.scope,
            expires_at: expiresAt,
            extra: { reddit_id: me.id }
        });
		res.redirect(`${FRONTEND_URL}/feed/reddit?connected=reddit`);
	} catch (error) {
        console.log("/reddit/callback error:", error);
		res.status(500).send('Reddit auth error');
	}
});

router.get('/mastodon/callback', async (req, res) => {
	try {
		const { code, state } = req.query;
		const payload = JSON.parse(state || '{}');
		const { instance, user_id } = payload;
		if (!instance || !code) {
			return res.status(400).send('Invalid Mastodon callback');
		}
		const app = await ConnectedAccounts.findOne({
			where: { user_id, platform: 'mastodon' }
		});
		if (!app) return res.status(400).send('Missing client credentials');
		const { client_id, client_secret } = typeof app.extra === 'string'
			? JSON.parse(app.extra)
			: app.extra;
		const base = `https://${instance}`;
		const tokenResponse = await fetch(`${base}/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id,
				client_secret,
				redirect_uri: process.env.MASTODON_REDIRECT_URI,
				code
			})
		});
		const tokenJson = await tokenResponse.json();
		if (!tokenResponse.ok || !tokenJson.access_token) {
			return res.status(502).send('Token exchange failed');
		}
		const meResp = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
			headers: { Authorization: `Bearer ${tokenJson.access_token}` }
		});
		const me = await meResp.json();
		await ConnectedAccounts.upsert({
			id: v4(),
			user_id,
			platform: 'mastodon',
			handle: me.acct,
			access_token: tokenJson.access_token,
			refresh_token: null,
			token_type: 'Bearer',
			scope: 'read follow',
			expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000),
			extra: {
				instance,
				client_id,
				client_secret,
				mastodon_id: me.id
			}
		});
		res.redirect(`${process.env.FRONTEND_URL}/feed/mastodon?connected=mastodon`);
	} catch (error) {
		console.log('/mastodon/callback error:', error);
		res.status(500).send('Mastodon auth error');
	}
});

router.get('/reddit/feed', authenticateCheck, async (req, res) => {
	try {
		const { limit = '50', after } = req.query;
		const account = await ConnectedAccounts.findOne({ where: { user_id: req.user.user_id, platform: 'reddit' } });
		if (!account) return res.status(404).json({ success: false, error: 'Not connected' });
		const token = await ensureRedditAccessToken(account);
		const params = new URLSearchParams({ limit: String(Math.min(Number(limit) || 25, 100)) });
		if (after) params.set('after', after);
		const response = await fetch(`https://oauth.reddit.com/best?${params.toString()}`, {
			headers: {
				'Authorization': `bearer ${token}`,
				'User-Agent': ua()
			}
		});
		if (!response.ok) return res.status(502).json({ success: false, error: 'Upstream error' });
		const json = await response.json();
		const children = json.data.children.filter(c => c.kind === 't3');
		const avatarMap = {};
		await Promise.all(children.map(async child => {
			const mapped = mapRedditToExternal(child);
			const username = (mapped.author || '').replace('u/', '');
			const avatar = await fetchRedditUserProfile(username, token);
			avatarMap[username] = avatar
				? avatar.replace(/&amp;/g, '&')
				: null;
		}));
		const out = [];
		for (const child of children) {
			const mapped = mapRedditToExternal(child);
			const username = (mapped.author || '').replace('u/', '');
			const contentHTML = generateRedditContentHTML(mapped.text_body, mapped.media);
			out.push({
				post_id: mapped.post_id,
				title: mapped.title,
				content: `data:text/html;charset=utf-8,${encodeURIComponent(contentHTML)}`,
				created_at: mapped.created_at_remote || new Date(),
				upvotes: mapped.score ?? 0,
				downvotes: 0,
				views: 0,
				replies: mapped.replies ?? 0,
				score: mapped.score || 0,
				is_saved: false,
				has_upvoted: false,
				has_downvoted: false,
				poster: {
					username: mapped.author || 'reddit_user',
					user_photo: avatarMap[username] || '/media/site_images/default-reddit-user-icon.png',
					profile_url: `https://www.reddit.com/user/${username}`
				},
				channel: mapped.subreddit || 'reddit',
				url: mapped.url,
				source: 'Reddit',
				rank_hotness: computeHotness({
					upvotes: mapped.score ?? 0,
					downvotes: 0,
					createdAt: mapped.created_at_remote,
					referenceTime: Date.now()
				})
			});
		}
		const mappedPosts = children.map(child => {
			const mapped = mapRedditToExternal(child);
			const username = (mapped.author || '').replace('u/', '');
			mapped.author_photo = avatarMap[username] || null;
			return mapped;
		});
		await ExternalPosts.bulkCreate(mappedPosts, {
			updateOnDuplicate: [
				'title',
				'text_body',
				'media',
				'score',
				'replies',
				'created_at_remote',
				'fetched_at',
				'author_photo',
				'image_count',
				'video_count'
			],
			ignoreDuplicates: true
		});
		const accessRows = mappedPosts.map(p => ({
			id: v4(),
			post_id: p.post_id,
			user_id: req.user.user_id,
			created_at: new Date()
		}));
		if (accessRows.length) {
			await ExternalPostsAccess.bulkCreate(accessRows, { ignoreDuplicates: true });
		}
		res.status(200).json({ success: true, after: json.data.after || null, before: json.data.before || null, items: out });
		//Background embedding generation
		(async () => {
			for (const p of mappedPosts) {
				const exists = await ExternalPosts.findOne({
					where: { post_id: p.post_id },
					attributes: ['embeddings']
				});
				const source = `${p.title || ''} ${p.text_body || ''}`.trim();
				if (source && (!exists || !exists.embeddings)) {
					const emb = await contentAnalyser.generateEmbedding(source);
					const sentiment = await contentAnalyser.calculateSentiment(source);
					await ExternalPosts.update(
						{ embeddings: JSON.stringify(emb), sentiment_score: sentiment },
						{ where: { post_id: p.post_id } }
					);
				}
			}
		})();
	} catch (error) {
		console.log("/reddit/feed error:", error);
		res.status(500).json({ success: false, error: 'Feed error' });
	}
});

router.get('/mastodon/feed', authenticateCheck, async (req, res) => {
	try {
		const account = await ConnectedAccounts.findOne({
			where: { user_id: req.user.user_id, platform: 'mastodon' }
		});
		if (!account) {
			return res.status(404).json({ success: false, error: 'Not connected' });
		}
		const token = await ensureMastodonToken(account);
		const extra = typeof account.extra === 'string' ? JSON.parse(account.extra) : account.extra;
		const instance = extra?.instance;
		const limit = req.query.limit || 40;
		const response = await fetch(`https://${instance}/api/v1/timelines/home?limit=${limit}`, {
			headers: { Authorization: `Bearer ${token}` }
		})
		if (!response.ok) return res.status(502).json({ success: false, error: 'Upstream error' });
		const feed = await response.json();
		const mappedPosts = feed.map(toot => mapMastodonToExternal(toot, instance));
		const items = mappedPosts.map(p => {
			const html = generateMastodonContentHTML(p.text_body, p.media);
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
				rank_hotness: computeHotness({
					upvotes: p.score ?? 0,
					downvotes: 0,
					createdAt: p.created_at_remote,
					referenceTime: Date.now()
				})
			};
		});
		await ExternalPosts.bulkCreate(mappedPosts, {
			updateOnDuplicate: [
				'text_body',
				'media',
				'score',
				'replies',
				'created_at_remote',
				'fetched_at',
				'author_photo',
				'image_count',
				'video_count'
			],
			ignoreDuplicates: true
		});
		const accessRows = mappedPosts.map(p => ({
			id: v4(),
			post_id: p.post_id,
			user_id: req.user.user_id,
			created_at: new Date()
		}));
		if (accessRows.length) {
			await ExternalPostsAccess.bulkCreate(accessRows, { ignoreDuplicates: true });
		}
		res.status(200).json({ success: true, items });
		//Background embedding generation
		(async () => {
			for (const p of mappedPosts) {
				const exists = await ExternalPosts.findOne({
					where: { post_id: p.post_id },
					attributes: ['embeddings']
				});
				const src = p.text_body || '';
				if (src.trim() && (!exists || !exists.embeddings)) {
					const emb = await contentAnalyser.generateEmbedding(src);
					const sentiment = await contentAnalyser.calculateSentiment(src);
					await ExternalPosts.update(
						{ embeddings: JSON.stringify(emb), sentiment_score: sentiment },
						{ where: { post_id: p.post_id } }
					);
				}
			}
		})();
	} catch (error) {
		console.log('/mastodon/feed error:', error);
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
        console.log("/reddit/expire error:", error);
		res.status(500).json({ success: false, error: 'Expire error' });
	}
});

export default router;