import { ExternalPosts } from "../../models/content.js";
import { mapBlueskyToExternal } from "./map_to_external/mapBlueskyToExternal.js";
import { mapRedditToExternal } from "./map_to_external/mapRedditToExternal.js";
import { mapMastodonToExternal } from "./map_to_external/mapMastodonToExternal.js";
import { GenerateBlueskyHTML } from "./generate_html/generateBlueskyHTML.js";
import { GenerateRedditHTML } from "./generate_html/generateRedditHTML.js";
import { GenerateMastodonHTML } from "./generate_html/generateMastodonHTML.js";
import { ua } from "./ua.js";

async function fetchRedditReplies(post, accessToken) {
	try {
		const articleId = post.source_post_id || post.url?.match(/comments\/([^\/]+)/)?.[1];
		if (!articleId) {
			console.log('[fetchRedditReplies] No article ID found');
			return [];
		}
		const apiUrl = `https://oauth.reddit.com/comments/${articleId}`;
		const response = await fetch(apiUrl, {
			headers: {
				'Authorization': `bearer ${accessToken}`,
				'User-Agent': ua()
			}
		});
		if (!response.ok) {
			return [];
		}
		const data = await response.json();
		const comments = data[1]?.data?.children || [];
		const replies = [];
		//Helper function to recursively process comments and their nested replies
		const processComment = (comment, parentPostId) => {
			if (comment.kind !== 't1') {
				return;
			}
			//Map the comment
			const mapped = mapRedditToExternal(comment);
			mapped.parent_id = parentPostId;
			replies.push(mapped);
			//Process nested replies if they exist
			if (comment.data.replies && typeof comment.data.replies === 'object' && comment.data.replies.data) {
				const nestedReplies = comment.data.replies.data.children || [];
				for (const nestedComment of nestedReplies) {
					processComment(nestedComment, mapped.post_id);
				}
			}
		};
		for (const comment of comments) {
			processComment(comment, post.post_id);
		}
		return replies;
	} catch (error) {
		console.error('[fetchRedditReplies] Error:', error);
		console.error('[fetchRedditReplies] Error stack:', error.stack);
		return [];
	}
}

async function fetchBlueskyReplies(post, accessToken) {
	try {
		const uri = post.source_post_id || post.url;
		if (!uri || !uri.startsWith('at://')) {
			return [];
		}
		// Increase depth to get nested replies
		const apiUrl = `https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=10`;
		const response = await fetch(apiUrl, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		});
		if (!response.ok) {
			const errorText = await response.text();
			return [];
		}
		const data = await response.json();
		const replies = [];
		//Helper function to recursively process replies and their nested replies
		const processReply = (reply, parentPostId) => {
			if (!reply.post) {
				return;
			}
			//Map the reply
			const mapped = mapBlueskyToExternal(reply);
			mapped.parent_id = parentPostId;
			replies.push(mapped);
			//Process nested replies if they exist
			if (reply.replies && Array.isArray(reply.replies)) {
				for (const nestedReply of reply.replies) {
					processReply(nestedReply, mapped.post_id);
				}
			}
		};
		const threadReplies = data.thread?.replies || [];
		for (const reply of threadReplies) {
			processReply(reply, post.post_id);
		}
		return replies;
	} catch (error) {
		console.error('[fetchBlueskyReplies] Error:', error);
		console.error('[fetchBlueskyReplies] Error stack:', error.stack);
		return [];
	}
}

async function fetchMastodonReplies(post, accessToken, instanceUrl) {
	try {
		const statusId = post.source_post_id;
		if (!statusId) {
			return [];
		}
		const apiUrl = `${instanceUrl}/api/v1/statuses/${statusId}/context`;
		const response = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (!response.ok) {
			const errorText = await response.text();
			return [];
		}
		const data = await response.json();
		const replies = [];
		const descendants = data.descendants || [];
		//Process ALL descendants, not just direct replies, each descendant's in_reply_to_id tells us its parent
		for (const reply of descendants) {
			const mapped = mapMastodonToExternal(reply, instanceUrl);
			//Set parent_id based on in_reply_to_id
			//The parent could be the original post or another reply
			mapped.parent_id = `mastodon:${reply.in_reply_to_id}`;
			replies.push(mapped);
		}
		return replies;
	} catch (error) {
		console.error('[fetchMastodonReplies] Error:', error);
		console.error('[fetchMastodonReplies] Error stack:', error.stack);
		return [];
	}
}

export async function fetchAndStoreReplies({ post, accessToken, instanceUrl }) {
	const platform = post.source.toLowerCase();
	let replies = [];
	switch (platform) {
		case 'reddit':
			replies = await fetchRedditReplies(post, accessToken);
			break;
		case 'bluesky':
			replies = await fetchBlueskyReplies(post, accessToken);
			break;
		case 'mastodon':
			replies = await fetchMastodonReplies(post, accessToken, instanceUrl);
			break;
		default:
			return [];
	}
	//Store replies in database
	const storedReplies = [];
	for (let i = 0; i < replies.length; i++) {
		const reply = replies[i];
		try {
			//Extract and store quoted post if present
			const qp = reply.media?.quotedPost;
			if (qp) {
				let quotedPostId, quotedHtml, quotedMedia, quotedTextBody;
				if (platform === 'bluesky' && qp.uri) {
					quotedPostId = `bluesky:${qp.uri}`;
					quotedTextBody = qp.text || '';
					quotedMedia = { images: qp.images || [], videos: qp.videos || [], card: qp.card || null };
					quotedHtml = await GenerateBlueskyHTML(quotedTextBody, quotedMedia);
				} else if (platform === 'mastodon' && qp.id) {
					quotedPostId = `mastodon:${qp.id}`;
					quotedTextBody = qp.text || '';
					quotedMedia = { attachments: qp.attachments || [], card: qp.card || null };
					quotedHtml = await GenerateMastodonHTML(qp.content || '', quotedMedia);
				}
				if (quotedPostId && quotedHtml && quotedHtml.trim() !== '') {
					await ExternalPosts.upsert({
						post_id: quotedPostId,
						source: platform,
						source_post_id: platform === 'bluesky' ? qp.uri : qp.id,
						content: quotedHtml,
						text_body: quotedTextBody,
						text_length: quotedTextBody.length,
						word_count: quotedTextBody ? quotedTextBody.split(/\s+/).length : 0,
						has_text: quotedTextBody.length > 0,
						score: 0,
						replies: 0,
						fetched_at: new Date(),
						created_at_remote: qp.createdAt ? new Date(qp.createdAt) : new Date(),
						expired: false,
						channel: platform === 'bluesky' ? (qp.author?.handle || null) : null,
						author: qp.author?.handle || null,
						author_did: platform === 'bluesky' ? (qp.author?.did || null) : null,
						author_photo: qp.author?.avatar || null,
						url: platform === 'bluesky'
							? `https://bsky.app/profile/${qp.author?.handle}/post/${qp.uri.split('/').pop()}`
							: (qp.url || null),
						media: quotedMedia,
						cid: platform === 'bluesky' ? (qp.cid || null) : null
					});
					reply.quoted_external_post_id = quotedPostId;
				}
			}
			//Generate HTML content
			let htmlContent = '';
			if (platform === 'reddit') {
				htmlContent = await GenerateRedditHTML(reply.text_body, reply.media);
			} else if (platform === 'bluesky') {
				htmlContent = await GenerateBlueskyHTML(reply.text_body, reply.media);
			} else if (platform === 'mastodon') {
				htmlContent = await GenerateMastodonHTML(reply.text_body, reply.media);
			}
			// Skip replies with empty/null content
			if (!htmlContent || htmlContent.trim() === '') {
				continue;
			}
			reply.content = htmlContent;
			//Upsert the reply
			const [replyPost] = await ExternalPosts.upsert(reply, { returning: true });
			storedReplies.push(replyPost);
		} catch (error) {
			console.error(`[fetchAndStoreReplies] Error storing reply ${i + 1}:`, error);
			console.error('[fetchAndStoreReplies] Error stack:', error.stack);
			console.error('[fetchAndStoreReplies] Failed reply data:', reply);
		}
	}
	return storedReplies;
}
