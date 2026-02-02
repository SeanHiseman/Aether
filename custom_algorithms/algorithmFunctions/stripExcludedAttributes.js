//Properties that the frontend does not need to receive
export const excludedAttrs = [
	'rank_hotness',
	'rank_updated_at',
    'image_count',
    'video_count',
    'sentiment_score',
    'language',
    'tokens',
    'embeddings',
	'boost_amount'
];

export function stripExcludedAttributes(posts) {
	return posts.map(p => {
		const obj = p.dataValues ? { ...p.dataValues } : { ...p };
		excludedAttrs.forEach(attr => delete obj[attr]);
		return obj;
	});
}