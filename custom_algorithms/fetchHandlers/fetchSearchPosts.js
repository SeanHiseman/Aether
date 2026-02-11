import { ExternalPosts, ExternalPostVotes } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { attachQuotedExternalPosts, formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Op } from 'sequelize';
import { Posts } from "../../models/relationships.js";
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";
import Sequelize from 'sequelize';

export async function fetchSearchPosts({ keyword, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams }) {
	//Prepare search term for BOOLEAN MODE: wrap phrases in quotes for exact matching
	const searchTerm = keyword.trim().includes(' ')
		? `"${keyword.replace(/"/g, '\\"')}"`
		: keyword;
	const escapedKeyword = Posts.sequelize.escape(searchTerm);
	if (hasActiveAlgorithm) {
		//Algorithm path: fetch all candidates from both tables, score, then paginate
		const nativePostIds = await Posts.findAll({
			attributes: ['post_id'],
			where: {
				...algorithmFilters,
				is_private: false,
				[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${escapedKeyword} IN BOOLEAN MODE)`)
			},
			order: [['created_at', 'DESC']],
			limit: MAX_ALGORITHM_CANDIDATES,
			raw: true
		});
		const externalPostIds = await ExternalPosts.findAll({
			attributes: ['post_id'],
			where: {
				expired: false,
				[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${escapedKeyword} IN BOOLEAN MODE)`)
			},
			order: [['created_at_remote', 'DESC']],
			limit: MAX_ALGORITHM_CANDIDATES,
			raw: true
		});
		if (!nativePostIds.length && !externalPostIds.length) {
			return { posts: [], status: "ok", message: "" };
		}
		const { paginatedIds, paginatedExternalIds, scoreMap } = await scoreAndPaginateCandidates({
			nativePostIds: nativePostIds.map(p => p.post_id),
			externalPostIds: externalPostIds.map(p => p.post_id),
			algorithmRow,
			scoringParams,
			offset,
			limit
		});
		if (!paginatedIds?.length && !paginatedExternalIds?.length) {
			return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
		}
		return await fetchPaginatedPostData({
			paginatedIds,
			paginatedExternalIds,
			scoreMap,
			includeOptions,
			attrOption
		});
	} else {
		//Standard path - merge results from both tables
		const nativePostIds = await Posts.findAll({
			attributes: ['post_id', 'created_at'],
			where: {
				...algorithmFilters,
				is_private: false,
				[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${escapedKeyword} IN BOOLEAN MODE)`)
			},
			order: orderMode,
			limit: backendFetchTotal,
			raw: true
		});
		const externalPostIds = await ExternalPosts.findAll({
			attributes: ['post_id', 'created_at_remote'],
			where: {
				expired: false,
				[Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${escapedKeyword} IN BOOLEAN MODE)`)
			},
			order: [['created_at_remote', 'DESC']],
			limit: backendFetchTotal,
			raw: true
		});
		if (!nativePostIds.length && !externalPostIds.length) {
			return { posts: [], status: "ok", message: "" };
		}
		const combinedResults = [
			...nativePostIds.map(p => ({
				post_id: p.post_id,
				created_at: p.created_at,
				isExternal: false
			})),
			...externalPostIds.map(p => ({
				post_id: p.post_id,
				created_at: p.created_at_remote,
				isExternal: true
			}))
		];
		//Sort by created_at descending (adjust based on orderMode if needed)
		combinedResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
		//Apply pagination
		const paginatedResults = combinedResults.slice(offset, offset + limit);
		const nativeIds = paginatedResults.filter(r => !r.isExternal).map(r => r.post_id);
		const externalIds = paginatedResults.filter(r => r.isExternal).map(r => r.post_id);
		//Fetch full data for native posts
		let nativePosts = [];
		if (nativeIds.length) {
			nativePosts = await Posts.findAll({
				where: { post_id: nativeIds },
				include: includeOptions,
				attributes: attrOption,
				raw: false
			});
		}
		//Fetch full data for external posts
		let externalPosts = [];
		if (externalIds.length) {
			let rawExternal = await ExternalPosts.findAll({
				where: { post_id: externalIds, content: { [Op.ne]: null } },
				raw: true
			});
			rawExternal = await attachQuotedExternalPosts(rawExternal);
			externalPosts = rawExternal.map(p => {
				const platformConfig = FEED_CONFIG[p.source];
				return formatExternalPost(p, platformConfig, p.source);
			});
		}
		//Combine and restore original order
		const allPosts = [
			...nativePosts.map(p => ({ ...(p.dataValues || p), isExternal: false })),
			...externalPosts.map(p => ({ ...(p.dataValues || p), isExternal: true })),
		];
		const orderMap = new Map(paginatedResults.map((r, i) => [r.post_id, i]));
		return allPosts.sort((a, b) => {
			const idA = a.post_id;
			const idB = b.post_id;
			return orderMap.get(idA) - orderMap.get(idB);
		});
	}
}