import { ExternalPosts } from "../../models/content.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { formatExternalPost } from "../../functions/external_posts/formatExternalPost.js"
import { Op } from "sequelize";
import { Posts } from "../../models/relationships.js";

//Fetches full post data for paginated IDs and restores algorithm score ordering
export async function fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption }) {
	const nativeIdsToFetch = paginatedIds.filter(p => !p.isExternal).map(p => p.post_id);
	const externalIdsToFetch = paginatedIds.filter(p => p.isExternal).map(p => p.post_id);
	let finalNativePosts = [];
	if (nativeIdsToFetch.length) {
		finalNativePosts = await Posts.findAll({
			where: { post_id: { [Op.in]: nativeIdsToFetch } },
			include: includeOptions,
			attributes: attrOption,
			raw: false
		});
	}
	let finalExternalPosts = [];
	if (externalIdsToFetch.length) {
		const rawExternal = await ExternalPosts.findAll({
			where: { post_id: { [Op.in]: externalIdsToFetch }, content: { [Op.ne]: null } },
			raw: true
		});
		finalExternalPosts = rawExternal.map(p => {
			const platformConfig = FEED_CONFIG[p.source];
			return formatExternalPost(p, platformConfig, p.source);
		});
	}
	//Merge and restore algorithm score ordering
	const nativeWithFlag = finalNativePosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
	const externalWithFlag = finalExternalPosts.map(p => ({ ...p, isExternal: true }));
	const allPosts = [...nativeWithFlag, ...externalWithFlag];
	allPosts.sort((a, b) => {
		const scoreA = scoreMap.get(a.post_id)?.algorithmScore || 0;
		const scoreB = scoreMap.get(b.post_id)?.algorithmScore || 0;
		if (scoreB !== scoreA) return scoreB - scoreA;
		return b.post_id.localeCompare(a.post_id);
	});
	return allPosts.map(p => {
		const algScore = scoreMap.get(p.post_id)?.algorithmScore || 0;
		return {
			...p,
			algorithmScore: algScore
			//score remains as the original platform score (likes) for display
		};
	});
}