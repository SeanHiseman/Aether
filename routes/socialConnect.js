import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import { computeHotness } from '../functions/postRanking.js';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import cron from 'node-cron';
import crypto from 'crypto';
import { ConnectedAccounts, Users } from '../models/users.js';
import dotenv from 'dotenv';
import { ExternalPosts, ExternalPostsAccess, PaginationTokens } from '../models/content.js';
import express from 'express';
import fetch from 'node-fetch';
import { getEmbedder } from '../functions/contentAnalyser.js';
import { Op } from 'sequelize';
import sequelize from '../databaseSetup.js';
import { v4 } from 'uuid';

const contentAnalyser = new ContentAnalyser();
dotenv.config();
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

function escapeHtml(string) {
	return (string || '').toString()
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const FEED_CONFIG = {
    bluesky: {
        generator: generateBlueskyContentHTML,
        defaultIcon: '/media/site_images/default-bluesky-user-icon.png',
        sourceName: 'Bluesky',
        getProfileUrl: (p) => p.author ? `https://bsky.app/profile/${p.author}` : null,
        getChannel: (p) => p.channel,
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
        getChannel: (p) => p.author, //not p.channel
    }
};

//Format for return to frontend
export function formatExternalPost(p, config, platform) {
	const authorName = p.author || `${platform}_user`;
	const profileUrl = p.source === 'reddit'
		? `https://www.reddit.com/user/${(p.author || '').replace('u/','')}`
		: p.source === 'bluesky'
		? `https://bsky.app/profile/${p.author}`
		: config.getProfileUrl(p);
	const scoreValue = p.score ?? 0;
	const sourceLabel = p.source === 'reddit' ? 'Reddit' : p.source === 'bluesky' ? 'Bluesky' : config.sourceName;
	return {
		...p,
		channel: p.channel || config.getChannel(p),
		content: p.content,
		created_at: p.created_at_remote,
		downvotes: 0,
		has_downvoted: false,
		has_embedded_websites: false,
		has_external_posts: false,
		has_interactive: false,
		has_upvoted: false,
		is_external: true,
		is_saved: false,
		poster: {
			profile_url: profileUrl,
			user_photo: p.author_photo || config.defaultIcon,
			username: authorName
		},
		replies: p.replies || 0,
		score: scoreValue,
		source: sourceLabel,
		text_body: p.text_body,
		title: p.title,
		upvotes: scoreValue,
		url: p.url,
		views: 0
	};
}

async function fetchAndProcessPosts(platform, fetchConfig, user_id) {
	try {
		const { url, headers, mapper, htmlGenerator } = fetchConfig;
		const resp = await fetch(url, { headers });
		const data = await resp.json();
		let mappedPosts = [];
		let nextToken = null;
		//Map and compute nextToken
		switch (platform) {
			case 'bluesky': {
				if (!data || !data.feed) return [];
				data.feed = data.feed.filter(item => !item.reply); //avoid replies
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
				//batch dedupe
				const localSeen = new Set();
				mappedPosts = mappedPosts.filter(p => {
					if (localSeen.has(p.post_id)) return false;
					localSeen.add(p.post_id);
					return true;
				});
				//mappedPosts = mappedPosts.filter(p => p.content != null);
				nextToken = data.cursor ? { cursor: data.cursor } : null;
				break;
			}
			case 'reddit': {
				const children = (data?.data?.children || []).filter(c => c.kind === 't3');
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
				const localSeen = new Set();
				mappedPosts = mappedPosts.filter(p => {
					if (localSeen.has(p.post_id)) return false;
					localSeen.add(p.post_id);
					return true;
				});
				//mappedPosts = mappedPosts.filter(p => p.content != null);
				nextToken = data?.data?.after ? { after: data.data.after } : null;
				break;
			}
			case 'mastodon': {
				if (!Array.isArray(data)) return [];
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
				const localSeen = new Set();
				mappedPosts = mappedPosts.filter(p => {
					if (localSeen.has(p.post_id)) return false;
					localSeen.add(p.post_id);
					return true;
				});
				//mappedPosts = mappedPosts.filter(p => p.content != null);
				//Mastodon pagination uses the last item id as max_id
				if (mappedPosts.length > 0) {
					nextToken = { max_id: mappedPosts[mappedPosts.length - 1].source_post_id };
				} else {
					nextToken = null;
				}
				break;
			}
			default:
				return [];
		}
		if (mappedPosts.length === 0) {
			//Persist token if provided, to avoid re-fetching same page
			if (nextToken) {
				const existingToken = await PaginationTokens.findOne({ where: { user_id, platform } });
				const tokenId = existingToken?.id || v4();
				await PaginationTokens.upsert({
					id: tokenId,
					user_id,
					platform,
					...nextToken,
					updated_at: new Date()
				});
			}
			return [];
		}
		const postIds = mappedPosts.map(p => p.post_id);
		const existingGlobal = await ExternalPosts.findAll({
			where: { post_id: postIds },
			attributes: ['post_id'],
			raw: true
		});
		const existingGlobalIds = new Set(existingGlobal.map(r => r.post_id));
		const existingUserAccess = await ExternalPostsAccess.findAll({
			where: {
				user_id,
				source: platform,
				post_id: postIds
			},
			attributes: ['post_id'],
			raw: true
		});
		const existingUserAccessIds = new Set(existingUserAccess.map(r => r.post_id));
		//Posts to insert into external_posts
		const postsToInsert = mappedPosts.filter(p => !existingGlobalIds.has(p.post_id));
		//Posts to grant access to this user, regardless of global existence
		const postsToGrantAccess = mappedPosts.filter(p => !existingUserAccessIds.has(p.post_id));
		//Only enrich and insert truly new-global posts
		let enriched = [];
		if (postsToInsert.length > 0) {
			const embedder = await getEmbedder();
			enriched = await Promise.all(postsToInsert.map(async mapped => {
				const html = platform === 'mastodon'
					? await htmlGenerator(mapped.content, mapped.media)
					: await htmlGenerator(mapped.text_body, mapped.media);
				const details = await contentAnalyser.analyseContent(html, mapped.title, embedder);
				const sentiment_score = details?.sentiment_score ?? 0;
				const embeddings = details?.embeddings ?? null;
				const has_text = (mapped.text_body?.length || 0) > 0;
				return {
					post_id: mapped.post_id,
					source: mapped.source,
					source_post_id: mapped.source_post_id,
					title: mapped.title || null,
					content: html,
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
			}));
			const updateFields = [
				'source_post_id', 'title', 'content', 'text_body', 'text_length', 'word_count',
				'image_count', 'video_count', 'has_text', 'has_images', 'has_videos',
				'score', 'replies', 'sentiment_score', 'embeddings',
				'fetched_at', 'created_at_remote', 'expired', 'channel', 'author',
				'author_photo', 'url', 'media'
			];
			//Prevent excessively large db uploads
			const batchSize = 20;
			for (let i = 0; i < enriched.length; i += batchSize) {
				const batch = enriched.slice(i, i + batchSize);
				await ExternalPosts.bulkCreate(batch, {
					updateOnDuplicate: updateFields,
					logging: false
				});
			}
		}
		//Grant per-user access for posts the user hasn't seen yet
		if (postsToGrantAccess.length > 0) {
			const accessRows = postsToGrantAccess.map(p => ({
				id: v4(),
				post_id: p.post_id,
				source: platform,
				user_id,
				created_at: new Date()
			}));
			await ExternalPostsAccess.bulkCreate(accessRows, { ignoreDuplicates: true });
		}
		// Persist pagination token
		if (nextToken) {
			const existingToken = await PaginationTokens.findOne({ where: { user_id, platform } });
			const tokenId = existingToken?.id || v4();
			await PaginationTokens.upsert({
				id: tokenId,
				user_id,
				platform,
				...nextToken,
				updated_at: new Date()
			});
		}
		return postsToGrantAccess;
	} catch (error) {
		console.error(new Date().toISOString(), `fetchAndProcessPosts ${platform} error:`, error);
		throw error;
	}
}

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

export async function generateBlueskyContentHTML(textBody, media) {
	//console.log("bluesky textBody:", textBody);
	try {
		let html = '';
		if (textBody?.trim()) {
			html += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					<p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p>
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

export async function generateRedditContentHTML(textBody, mediaArray) {
	//console.log("reddit textBody:", textBody);
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
					<p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p>
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

//Mastodon posts use html, not raw text
export async function generateMastodonContentHTML(htmlContent, media) {
	//console.log("generating html for mastodon from:", htmlContent);
	try {
		let out = '';
		if (htmlContent) {
			out += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					${htmlContent}
				</div>
			`;
		}
		if (media?.attachments && Array.isArray(media.attachments)) {
			for (const m of media.attachments) {
				if (!m.url) continue;
				out += `
					<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
						<img src="${m.url}" alt="Mastodon media" />
					</div>
				`;
			}
		}
		//Create card (link preview)
		if (media?.card) {
			const card = media.card;
			out += `
				<div class="content-block link-preview" data-blockid="${crypto.randomUUID()}" data-align="center" data-trusted="false" data-embed-preview="true">
					<a href="${escapeHtml(card.url)}" target="_blank" rel="noopener noreferrer">
						${card.image ? `<div class="preview-image"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title || card.hostname)}" /></div>` : ''}
						<div class="preview-meta">
							<h4>${escapeHtml(card.title || card.hostname || card.url)}</h4>
							${card.description ? `<p>${escapeHtml(card.description)}</p>` : ''}
							<span class="preview-host">${escapeHtml(card.hostname || new URL(card.url).hostname)}</span>
						</div>
					</a>
				</div>
			`;
		}
		return out.trim();
	} catch (error) {
		console.error(new Date().toISOString(), 'generateMastodonContentHTML error:', error);
		return '';
	}
}

//Mapping directly into database
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

//Mapping directly into database
function mapMastodonToExternal(toot, instance) {
	//Mastodon api does not provide raw text
	const htmlContent = toot.content || '';
	const rawText = htmlContent.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
	const media = {
		attachments: Array.isArray(toot.media_attachments)
			? toot.media_attachments.map(m => ({ url: m.url, type: m.type }))
			: [],
		card: toot.card ? {
			url: toot.card.url,
			title: toot.card.title,
			description: toot.card.description,
			image: toot.card.image,
			hostname: toot.card.provider_name || (toot.card.url ? new URL(toot.card.url).hostname : null)
		} : null
	};
	const postInstance = toot.url ? new URL(toot.url).origin : instance;
	//console.log("mastodon post instance:", postInstance);
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
		text_body: rawText,
		title: null,
		content: htmlContent,
		url: toot.url || null,
		text_length: rawText.length,
		word_count: rawText ? rawText.replace(/<[^>]*>/g, '').split(/\s+/).length : 0,
		image_count: Array.isArray(media) ? media.filter(m => m && m.url && (!m.type || m.type !== 'video')).length : 0,
		video_count: Array.isArray(media) ? media.filter(m => m && m.type === 'video').length : 0,
		has_images: Array.isArray(media) && media.length > 0,
		has_videos: false,
		channel: postInstance
	};
} 

//Mapping directly into database
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
			//console.log(`Bluesky connect fetched ${mappedPosts.length} posts for user ${req.user.user_id}`);
			mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
			//Return posts immediately
			const postsWithContent = await Promise.all(
				mappedPosts.map(async (p) => {
					const formatted = formatExternalPost(p, FEED_CONFIG.bluesky, 'bluesky');
					formatted.content = await FEED_CONFIG.bluesky.generator(p.text_body, p.media);
					return formatted;
				})
			);
            res.status(200).json({ success: true, did: json.did, posts: postsWithContent });
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
			htmlGenerator: generateRedditContentHTML,
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
		const mappedPosts = await fetchAndProcessPosts('mastodon', config, user_id);
		mappedPosts.sort((a, b) => b.rank_hotness - a.rank_hotness);
		const postsData = await Promise.all(
			mappedPosts.map(async (p) => {
				const formatted = formatExternalPost(p, FEED_CONFIG.mastodon, 'mastodon');
				formatted.content = await FEED_CONFIG.mastodon.generator(p.text_body, p.media);
				return formatted;
			})
		);
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
		//console.log("items fetched:", items.length);
        const extraPayload = platform === 'reddit' ? { after: null, before: null } : {};
        res.status(200).json({ success: true, items: items, status: status, message: message, ...extraPayload });
    } catch (error) {
        console.error(new Date().toISOString(), `/${platform}/feed error:`, error);
        res.status(400).json({ success: false });
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
}

export default router;