import { computeHotness } from "../postRanking.js";
import { ContentAnalyser } from "../contentAnalyser.js";
import { ExternalPosts, ExternalPostsAccess, PaginationTokens } from "../../models/content.js";
import { GenerateBlueskyHTML } from "./generate_html/generateBlueskyHTML.js";
import { GenerateMastodonHTML } from "./generate_html/generateMastodonHTML.js";
import { getEmbedder } from "../contentAnalyser.js";
import { refreshBlueskyToken } from "./token_refresh/refreshBlueskyToken.js";
import { refreshRedditToken } from "./token_refresh/refreshRedditToken.js";
import { v4 } from 'uuid';

const contentAnalyser = new ContentAnalyser();

export async function fetchAndProcessPosts(platform, fetchConfig, user_id) {
	try {
		let { url, headers, mapper, htmlGenerator } = fetchConfig;
		let resp = await fetch(url, { headers });
		// Handle expired tokens - try refresh for Reddit
		if (!resp.ok && resp.status === 401 && platform === 'reddit') {
			const newToken = await refreshRedditToken(user_id);
			if (newToken) {
				headers = { ...headers, 'Authorization': `bearer ${newToken}` };
				resp = await fetch(url, { headers });
			}
		}
		//Handle expired tokens for Bluesky (returns 400 with ExpiredToken)
		if (!resp.ok && resp.status === 400 && platform === 'bluesky') {
			const errorText = await resp.text();
			if (errorText.includes('ExpiredToken')) {
				//console.log(new Date().toISOString(), '[fetchAndProcessPosts] Bluesky token expired, attempting refresh...');
				const newToken = await refreshBlueskyToken(user_id);
				if (newToken) {
					headers = { ...headers, 'Authorization': `Bearer ${newToken}` };
					resp = await fetch(url, { headers });
				}
			}
		}
		// Check response before parsing JSON
		if (!resp.ok) {
			throw new Error(`API returned ${resp.status}: ${resp.statusText}`);
		}
		const data = await resp.json();
		let mappedPosts = [];
		let nextToken = null;
		//Map and compute nextToken
		switch (platform) {
			case 'bluesky': {
				if (!data || !data.feed) return [];
				//Filter out replies and reposts (but keep quote posts)
				data.feed = data.feed.filter(item => {
					//Exclude replies
					if (item.reply) return false;
					//Exclude reposts (identified by reason field)
					if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost') return false;
					return true;
				});
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
		//Extract quoted posts from media.quotedPost and create separate entries
		const quotedPostsToStore = [];
		for (const mapped of mappedPosts) {
			const qp = mapped.media?.quotedPost;
			if (!qp) continue;
			let quotedPostId, quotedHtml, quotedMedia, quotedTextBody, quotedAuthor, quotedAuthorPhoto, quotedUrl, quotedSourcePostId, quotedCreatedAt, quotedChannel;
			if (platform === 'bluesky' && qp.uri) {
				quotedPostId = `bluesky:${qp.uri}`;
				quotedSourcePostId = qp.uri;
				quotedTextBody = qp.text || '';
				quotedAuthor = qp.author?.handle || null;
				quotedAuthorPhoto = qp.author?.avatar || null;
				quotedUrl = `https://bsky.app/profile/${qp.author?.handle}/post/${qp.uri.split('/').pop()}`;
				quotedCreatedAt = qp.createdAt ? new Date(qp.createdAt) : new Date();
				quotedChannel = qp.author?.handle || null;
				quotedMedia = { images: qp.images || [], videos: qp.videos || [], card: qp.card || null };
				quotedHtml = await GenerateBlueskyHTML(quotedTextBody, quotedMedia);
			} else if (platform === 'mastodon' && qp.id) {
				quotedPostId = `mastodon:${qp.id}`;
				quotedSourcePostId = qp.id;
				quotedTextBody = qp.text || '';
				quotedAuthor = qp.author?.handle || null;
				quotedAuthorPhoto = qp.author?.avatar || null;
				quotedUrl = qp.url || null;
				quotedCreatedAt = qp.createdAt ? new Date(qp.createdAt) : new Date();
				quotedChannel = mapped.channel || null;
				quotedMedia = { attachments: qp.attachments || [], card: qp.card || null };
				quotedHtml = await GenerateMastodonHTML(qp.content || '', quotedMedia);
			} else {
				continue;
			}
			if (!quotedHtml || quotedHtml.trim() === '') continue;
			quotedPostsToStore.push({
				post_id: quotedPostId,
				source: platform,
				source_post_id: quotedSourcePostId,
				title: null,
				content: quotedHtml,
				text_body: quotedTextBody,
				text_length: quotedTextBody.length,
				word_count: quotedTextBody ? quotedTextBody.split(/\s+/).length : 0,
				image_count: (quotedMedia.images || quotedMedia.attachments || []).length,
				video_count: (quotedMedia.videos || []).length,
				has_text: quotedTextBody.length > 0,
				has_images: (quotedMedia.images || quotedMedia.attachments || []).length > 0,
				has_videos: (quotedMedia.videos || []).length > 0,
				score: 0,
				replies: 0,
				sentiment_score: 0,
				fetched_at: new Date(),
				created_at_remote: quotedCreatedAt,
				expired: false,
				channel: quotedChannel,
				author: quotedAuthor,
				author_did: platform === 'bluesky' ? (qp.author?.did || null) : null,
				author_photo: quotedAuthorPhoto,
				url: quotedUrl,
				media: quotedMedia,
				cid: platform === 'bluesky' ? (qp.cid || null) : null
			});
			//Set the reference on the parent and remove quotedPost from media
			//(it's now stored separately via quoted_external_post_id)
			mapped.quoted_external_post_id = quotedPostId;
			delete mapped.media.quotedPost;
		}
		//Store quoted posts (upsert to avoid duplicates)
		if (quotedPostsToStore.length > 0) {
			await ExternalPosts.bulkCreate(quotedPostsToStore, {
				updateOnDuplicate: ['content', 'text_body', 'author', 'author_photo', 'url', 'media', 'fetched_at'],
				logging: false
			});
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
				//Log if HTML generation failed
				if (!html || html.trim() === '') {
					return null; //Mark for filtering
				}
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
					media: mapped.media,
					cid: mapped.cid || null,
					quoted_external_post_id: mapped.quoted_external_post_id || null
				};
			}));
			//Filter out posts with failed HTML generation
			enriched = enriched.filter(p => p !== null);
			const updateFields = [
				'source_post_id', 'title', 'content', 'text_body', 'text_length', 'word_count',
				'image_count', 'video_count', 'has_text', 'has_images', 'has_videos',
				'score', 'replies', 'sentiment_score', 'embeddings',
				'fetched_at', 'created_at_remote', 'expired', 'channel', 'author',
				'author_photo', 'url', 'media', 'cid', 'quoted_external_post_id'
			];
			//Prevent excessively large db uploads
			const batchSize = 20;
			for (let i = 0; i < enriched.length; i += batchSize) {
				const batch = enriched.slice(i, i + batchSize);
				//Log CID info for Bluesky posts
				if (platform === 'bluesky') {
					const cidCount = batch.filter(p => p.cid).length;
				}
				await ExternalPosts.bulkCreate(batch, {
					updateOnDuplicate: updateFields,
					logging: false
				});
			}
		}
		//Update quoted_external_post_id for existing posts that now have a quoted post reference
		const existingWithQuotes = mappedPosts.filter(p => p.quoted_external_post_id && existingGlobalIds.has(p.post_id));
		for (const p of existingWithQuotes) {
			await ExternalPosts.update(
				{ quoted_external_post_id: p.quoted_external_post_id },
				{ where: { post_id: p.post_id } }
			);
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
		//Persist pagination token
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