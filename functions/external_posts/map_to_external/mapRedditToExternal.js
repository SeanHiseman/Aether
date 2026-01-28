export function mapRedditToExternal(child) {
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