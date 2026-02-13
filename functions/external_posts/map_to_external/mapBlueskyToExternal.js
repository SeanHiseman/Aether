export function mapBlueskyToExternal(item) {
	const post = item.post;
	const record = post.record || {};
	const text = record.text || '';
	//Log to check CID extraction
	if (!post.cid) {
		console.warn(new Date().toISOString(), '[mapBlueskyToExternal] No CID found in post:', {
			uri: post.uri,
			has_cid: !!post.cid,
			post_keys: Object.keys(post).join(', ')
		});
	}
	let images = null;
	let videos = null;
	let externalCard = null;
	let quotedPost = null;
	const embed = post.embed;
	if (embed) {
		const embedType = embed.$type || '';
		//Handle images (app.bsky.embed.images#view)
		if (embed.images && Array.isArray(embed.images)) {
			images = embed.images.map(img => ({
				url: img.fullsize || img.thumb || null,
				alt: img.alt || ''
			}));
		}
		//Handle videos (app.bsky.embed.video#view)
		if (embedType.includes('video') || embed.playlist) {
			const videoUrl = embed.playlist || embed.video?.playlist || null;
			const thumbnail = embed.thumbnail || embed.video?.thumbnail || null;
			if (videoUrl) {
				videos = [{ url: videoUrl, thumbnail, type: 'video' }];
			}
		}
		//Handle external embeds/link cards (app.bsky.embed.external#view)
		if (embedType.includes('external') && embed.external) {
			const ext = embed.external;
			externalCard = {
				uri: ext.uri || '',
				title: ext.title || '',
				description: ext.description || '',
				thumb: ext.thumb || null
			};
		}
		//Handle recordWithMedia (quote post with media)
		if (embed.media) {
			if (embed.media.images && Array.isArray(embed.media.images)) {
				images = embed.media.images.map(img => ({
					url: img.fullsize || img.thumb || null,
					alt: img.alt || ''
				}));
			}
			if (embed.media.playlist || embed.media.$type?.includes('video')) {
				const videoUrl = embed.media.playlist || null;
				const thumbnail = embed.media.thumbnail || null;
				if (videoUrl) {
					videos = [{ url: videoUrl, thumbnail, type: 'video' }];
				}
			}
			if (embed.media.external) {
				const ext = embed.media.external;
				externalCard = {
					uri: ext.uri || '',
					title: ext.title || '',
					description: ext.description || '',
					thumb: ext.thumb || null
				};
			}
		}
		//Handle quote posts (app.bsky.embed.record#view or app.bsky.embed.recordWithMedia#view)
		if (embed.record) {
			const quotedRecord = embed.record.record || embed.record;
			if (quotedRecord && quotedRecord.author) {
				//Extract quoted post images from its embed
				let quotedImages = null;
				let quotedVideos = null;
				let quotedCard = null;
				if (quotedRecord.embed) {
					const qEmbed = quotedRecord.embed;
					if (qEmbed.images && Array.isArray(qEmbed.images)) {
						quotedImages = qEmbed.images.map(img => ({
							url: img.fullsize || img.thumb || null,
							alt: img.alt || ''
						}));
					}
					if (qEmbed.playlist || qEmbed.$type?.includes('video')) {
						const videoUrl = qEmbed.playlist || null;
						const thumbnail = qEmbed.thumbnail || null;
						if (videoUrl) {
							quotedVideos = [{ url: videoUrl, thumbnail, type: 'video' }];
						}
					}
					if (qEmbed.external) {
						quotedCard = {
							uri: qEmbed.external.uri || '',
							title: qEmbed.external.title || '',
							description: qEmbed.external.description || '',
							thumb: qEmbed.external.thumb || null
						};
					}
				}
				const quotedPostRecord = quotedRecord.value || quotedRecord;
				quotedPost = {
					uri: quotedRecord.uri || embed.record.uri,
					cid: quotedRecord.cid || embed.record.cid,
					author: {
						handle: quotedRecord.author.handle || null,
						did: quotedRecord.author.did || null,
						displayName: quotedRecord.author.displayName || null,
						avatar: quotedRecord.author.avatar || null
					},
					text: quotedPostRecord.text || '',
					createdAt: quotedPostRecord.createdAt || null,
					images: quotedImages || [],
					videos: quotedVideos || [],
					card: quotedCard
				};
			}
		}
	}
	const media = {
		images: images || [],
		videos: videos || [],
		card: externalCard,
		quotedPost: quotedPost
	};
	//When a quoted post exists, remove the card if it's a preview of the quoted post
	//(to avoid showing the quoted post as both a card embed and a full ExternalPostWidget)
	if (quotedPost && media.card && media.card.uri && quotedPost.uri) {
		const rkey = quotedPost.uri.split('/').pop();
		if (rkey && quotedPost.author?.handle) {
			const quotedBskyUrl = `https://bsky.app/profile/${quotedPost.author.handle}/post/${rkey}`;
			if (media.card.uri === quotedBskyUrl) {
				media.card = null;
			}
		}
	}
	return {
		post_id: `bluesky:${post.uri}`,
		author: post.author?.handle || null,
		author_did: post.author?.did || null,
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
		channel: post.author?.handle || null,
		cid: post.cid || null
	};
}