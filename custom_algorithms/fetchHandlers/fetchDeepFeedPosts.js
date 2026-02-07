import { DeepFeedContent, Posts } from "../../models/relationships.js";
import { ExternalPosts } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { IntermixArrays } from "../../functions/intermixArrays.js";
import { Op } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";

export async function fetchDeepFeedPosts({ locationId, viewerId, hasActiveAlgorithm, algorithmFilters, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams }) {
	const deepFeedId = locationId.replace(/^deep_/, '');
	const contents = await DeepFeedContent.findAll({
		where: { deep_feed_id: deepFeedId },
		attributes: ['feed_id', 'external_did'],
		raw: true
	});
	const allFeedIds = contents.map(c => c.feed_id).filter(Boolean);
	const externalDids = contents.map(c => c.external_did).filter(Boolean);
	const hasExternalAccounts = externalDids.length > 0;
	if (hasActiveAlgorithm) {
		//Algorithm path
		let nativePostIds = [];
		if (allFeedIds.length > 0) {
			nativePostIds = await Posts.findAll({
				attributes: ['post_id'],
				where: {
					...algorithmFilters,
				parent_id: null,
					feed_id: { [Op.in]: allFeedIds },
							...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
				},
				order: [['created_at', 'DESC']],
				limit: MAX_ALGORITHM_CANDIDATES,
				raw: true
			});
		}
		//Fetch external posts from Bluesky accounts in the deep feed
		let externalPostIds = [];
		if (hasExternalAccounts) {
			const externalPosts = await ExternalPosts.findAll({
				attributes: ['post_id'],
				where: {
					source: 'bluesky',
					author_did: { [Op.in]: externalDids },
					expired: false,
					content: { [Op.ne]: null }
				},
				order: [['created_at_remote', 'DESC']],
				raw: true
			});
			externalPostIds = externalPosts.map(p => p.post_id);
		}
		const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
			nativePostIds: nativePostIds.map(p => p.post_id),
			externalPostIds,
			algorithmRow,
			scoringParams,
			offset,
			limit
		});
		if (!paginatedIds.length) {
			if (Object.keys(algorithmFilters).length > 0) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
	} else {
		//Standard path with mixed native and external posts
		const halfLimit = hasExternalAccounts ? Math.ceil(backendFetchTotal / 2) : backendFetchTotal;
		const halfOffset = hasExternalAccounts ? Math.floor(offset / 2) : offset;
		let localPosts = [];
		if (allFeedIds.length > 0) {
			const postIds = await Posts.findAll({
				attributes: ['post_id'],
				where: {
					...algorithmFilters,
				parent_id: null,
					feed_id: { [Op.in]: allFeedIds },
							...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
				},
				order: orderMode,
				limit: halfLimit,
				offset: halfOffset,
				raw: true
			});
			const orderedIds = postIds.map(p => p.post_id);
			if (orderedIds.length) {
				localPosts = await Posts.findAll({
					where: { post_id: orderedIds },
					include: includeOptions,
					attributes: attrOption,
					raw: false
				});
				const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
				localPosts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
			}
		}
		//Fetch external posts from Bluesky accounts
		let externalPosts = [];
		if (hasExternalAccounts) {
			const rawExternal = await ExternalPosts.findAll({
				where: {
					source: 'bluesky',
					author_did: { [Op.in]: externalDids },
					expired: false,
					content: { [Op.ne]: null }
				},
				order: [['created_at_remote', 'DESC']],
				limit: halfLimit,
				offset: halfOffset,
				raw: true
			});
			externalPosts = rawExternal.map(p => formatExternalPost(p, FEED_CONFIG.bluesky, 'bluesky'));
		}
		const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
		const externalWithFlag = externalPosts.map(p => ({ ...p, isExternal: true }));
		return IntermixArrays(localWithFlag, externalWithFlag).slice(0, backendFetchTotal);
	}
}