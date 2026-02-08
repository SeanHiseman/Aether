export function mapRedditToExternal(child) {
	const d = child.data;
	const isComment = child.kind === 't1'; // t1 = comment, t3 = post
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
	// Comments use 'body', posts use 'selftext'
	const textContent = isComment ? d.body : d.selftext;
	// For link posts, include the external URL and preview
	// Note: comments don't have link posts, only regular posts do
	let linkUrl = null;
	let linkThumbnail = null;
	if (!isComment && d.url && !d.is_self && !d.is_gallery) {
		// This is a link post (external URL)
		linkUrl = d.url;
		if (d.thumbnail && d.thumbnail !== 'self' && d.thumbnail !== 'default' && d.thumbnail.startsWith('http')) {
			linkThumbnail = d.thumbnail;
		}
	}
	const authorPhoto = 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_0.png';
	const finalMedia = linkUrl ? { link: { url: linkUrl, thumbnail: linkThumbnail } } : media;
	// Debug log for posts with no content - this shouldn't happen!
	if (!textContent && !finalMedia) {
		console.warn('[mapRedditToExternal] Post/comment with no text or media - API data:', {
			id: d.id,
			kind: child.kind,
			isComment,
			title: d.title?.substring(0, 80),
			is_self: d.is_self,
			is_gallery: d.is_gallery,
			has_url: !!d.url,
			url: d.url,
			has_preview: !!d.preview,
			preview_images_count: d.preview?.images?.length || 0,
			has_thumbnail: !!d.thumbnail,
			thumbnail: d.thumbnail,
			has_media: !!d.media,
			media_type: d.media?.type || null,
			post_hint: d.post_hint || null
		});
	}
	return {
		post_id: `reddit:${d.id}`,
		author: d.author ? `u/${d.author}` : null,
		author_photo: authorPhoto,
		created_at_remote: new Date(d.created_utc * 1000),
		expired: false,
		fetched_at: new Date(),
		media: finalMedia,
		score: typeof d.score === 'number' ? d.score : null,
		replies: typeof d.num_comments === 'number' ? d.num_comments : 0,
		source: 'reddit',
		source_post_id: d.id,
		text_body: textContent || null,
		title: isComment ? null : (d.title || null), // Comments don't have titles
		url: `https://www.reddit.com${d.permalink}`,
		text_length: textContent?.length || 0,
		word_count: textContent ? textContent.split(/\s+/).length : 0,
		image_count: Array.isArray(media) ? media.length : 0,
		video_count: d.media?.reddit_video ? 1 : 0,
		has_images: !!media || !!linkThumbnail,
		has_videos: !!d.media?.reddit_video,
		channel: d.subreddit || null,
	};
}