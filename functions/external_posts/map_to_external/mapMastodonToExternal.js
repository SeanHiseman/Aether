export function mapMastodonToExternal(toot, instance) {
	//Mastodon api does not provide raw text
	const htmlContent = toot.content || '';
	const rawText = htmlContent.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
	//Extract quoted post if present (Mastodon 4.5+)
	let quotedPost = null;
	if (toot.quote || toot.quoted_status) {
		const quoted = toot.quote || toot.quoted_status;
		const quotedHtmlContent = quoted.content || '';
		const quotedText = quotedHtmlContent.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
		//Extract quoted post media
		const quotedAttachments = Array.isArray(quoted.media_attachments)
			? quoted.media_attachments.map(m => ({ url: m.url, type: m.type }))
			: [];
		const quotedCard = quoted.card ? {
			url: quoted.card.url,
			title: quoted.card.title,
			description: quoted.card.description,
			image: quoted.card.image,
			hostname: quoted.card.provider_name || (quoted.card.url ? new URL(quoted.card.url).hostname : null)
		} : null;
		quotedPost = {
			id: quoted.id,
			url: quoted.url || null,
			author: {
				handle: quoted.account?.acct || null,
				displayName: quoted.account?.display_name || quoted.account?.username || null,
				avatar: quoted.account?.avatar || null
			},
			content: quotedHtmlContent,
			text: quotedText,
			createdAt: quoted.created_at || null,
			attachments: quotedAttachments,
			card: quotedCard
		};
	}
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
		} : null,
		quotedPost: quotedPost
	};
	const postInstance = toot.url ? new URL(toot.url).origin : instance;
	//console.log("mastodon post instance:", postInstance);
	return {
		post_id: `mastodon:${toot.id}`,
		author: toot.account?.acct || null,
		author_did: toot.account?.id || null, //Store numeric Mastodon account ID
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