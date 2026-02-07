import { ExternalPosts } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Op } from 'sequelize';
import { Posts } from "../../models/relationships.js";
import { QueryTypes } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";
import sequelize from "../../databaseSetup.js";

export async function fetchExplorePosts({ viewerId, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, lowVoteImpact, algorithmRow, scoringParams }) {
	//console.log(`[EXPLORE ALGORITHM] locationId=explore, offset=${offset}, limit=${limit}, hasActiveAlgorithm=${hasActiveAlgorithm}`);
	//console.log("explore MAX_ALGORITHM_CANDIDATES:", MAX_ALGORITHM_CANDIDATES);
	if (hasActiveAlgorithm) {
		//Algorithm path with external posts
		const nativePostIds = await Posts.findAll({
			attributes: ['post_id'],
			where: {
				...algorithmFilters,
			parent_id: null,
					...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
				is_private: false
			},
			order: [['created_at', 'DESC']],
			limit: MAX_ALGORITHM_CANDIDATES,
			raw: true
		});
		//console.log("nativePostIds length:", nativePostIds.length);
		//Fetch hottest external posts from all platforms (same for all users)
		//Use 3 day window with aggressive decay to heavily favor last 24 hours
		const externalPostsQuery = await sequelize.query(
			`SELECT p.post_id FROM external_posts p
			WHERE p.source IN ('reddit', 'bluesky', 'mastodon') AND p.expired = false
			AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 14 DAY) ${externalFiltersSQL}
			ORDER BY (p.score * EXP(-0.0001 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
			LIMIT :maxCandidates`,
			{ replacements: { maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
		);
		const externalPostIds = externalPostsQuery.map(a => a.post_id);
		//console.log("explore externalPostIds length:", externalPostIds.length);
		const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
			nativePostIds: nativePostIds.map(p => p.post_id),
			externalPostIds,
			algorithmRow,
			scoringParams,
			offset,
			limit
		});
		//console.log("explore paginatedIds.length:", paginatedIds.length);
		if (!paginatedIds.length) {
			if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
	} else {
		//Standard path with mixed native and external posts
		//Use proportional offsets but cap at a reasonable limit for performance
		const idealExternalTarget = Math.ceil(limit * 0.6);
		const idealNativeTarget = Math.ceil(limit * 0.4);
		//Cap offsets at 10k for performance (with indexes, should be < 100ms)
		//Beyond this, performance degrades significantly with OFFSET
		const MAX_OFFSET = 10000;
		const cappedOffset = Math.min(offset, MAX_OFFSET);
		const nativeOffset = Math.floor(cappedOffset * 0.4);
		const externalOffset = Math.floor(cappedOffset * 0.6);
		//if (offset > MAX_OFFSET) {
			//console.warn(`[EXPLORE ALGORITHM] Offset ${offset} exceeds MAX_OFFSET ${MAX_OFFSET}, capping to prevent performance degradation`);
		//}
		//Fetch external posts from all platforms combined
		//console.log(`[EXPLORE ALGORITHM] Fetching external: limit=${idealExternalTarget}, offset=${externalOffset}`);
		const perPlatformTarget = Math.ceil(idealExternalTarget / 3);
		const perPlatformOffset = Math.floor(externalOffset / 3);
		const platformQueries = ['bluesky', 'reddit', 'mastodon'].map(platform =>
			sequelize.query(
				`SELECT p.post_id, p.source FROM external_posts p
				WHERE p.source = :platform AND p.expired = false ${externalFiltersSQL}
				ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.0001 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
				LIMIT :limit OFFSET :offset`,
				{ replacements: { platform, limit: perPlatformTarget, offset: perPlatformOffset }, type: QueryTypes.SELECT }
			)
		);
		const platformResults = await Promise.all(platformQueries);
		const externalAccesses = platformResults.flat();
		//console.log(`[EXPLORE ALGORITHM] Found ${externalAccesses.length} external post IDs across all platforms`);
		const unifiedIds = externalAccesses.map(a => a.post_id);
		let externalPosts = [];
		if (unifiedIds.length) {
			externalPosts = await ExternalPosts.findAll({
				where: { post_id: unifiedIds, content: { [Op.ne]: null } },
				raw: true
			});
		}
		//console.log(`[EXPLORE ALGORITHM] Loaded ${externalPosts.length} external posts with content`);
		//Calculate how many native posts we need to reach the limit
		//If external is limited, fetch more native to compensate
		const externalShortfall = idealExternalTarget - externalPosts.length;
		const nativeTarget = idealNativeTarget + externalShortfall;
		//console.log(`[EXPLORE ALGORITHM] External shortfall: ${externalShortfall}, fetching ${nativeTarget} native posts from offset ${nativeOffset}`);
		const postIds = await Posts.findAll({
			attributes: ['post_id'],
			where: {
				...algorithmFilters,
			parent_id: null,
					...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
				is_private: false
			},
			order: orderMode,
			limit: nativeTarget,
			offset: nativeOffset,
			raw: true
		});
		//console.log(`[EXPLORE ALGORITHM] Found ${postIds.length} native post IDs`);
		const orderedIds = postIds.map(p => p.post_id);
		let localPosts = [];
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
		const formattedExternal = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[p.source], p.source));
		const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
		const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
		const externalBySource = { bluesky: [], mastodon: [], reddit: [] };
		for (const post of externalWithFlag) {
			const sourceLower = post.source?.toLowerCase();
			if (externalBySource[sourceLower]) {
				externalBySource[sourceLower].push(post);
			}
		}
		const externalSourceOrder = ['bluesky', 'reddit', 'mastodon'];
		let externalSourceIndex = 0;
		let nativeIndex = 0;
		const mixedPosts = [];
		const nativeWeight = 2;
		const externalWeight = 3;
		let nativeScore = 0;
		let externalScore = 0;
		//Mix posts from native and external sources with strict platform rotation
		while (
			mixedPosts.length < backendFetchTotal &&
			(nativeIndex < localWithFlag.length ||
			externalBySource.reddit.length ||
			externalBySource.bluesky.length ||
			externalBySource.mastodon.length)
		) {
			const externalAvailable =
				externalBySource.reddit.length ||
				externalBySource.bluesky.length ||
				externalBySource.mastodon.length;
			const chooseExternal =
				externalAvailable &&
				(nativeIndex >= localWithFlag.length || externalScore <= nativeScore);
			if (chooseExternal) {
				let selectedPost = null;
				//Strict rotation: try each source in order until we find one with posts
				let attempts = 0;
				while (!selectedPost && attempts < externalSourceOrder.length) {
					const source = externalSourceOrder[externalSourceIndex];
					if (externalBySource[source].length) {
						selectedPost = externalBySource[source].shift();
					}
					externalSourceIndex = (externalSourceIndex + 1) % externalSourceOrder.length;
					attempts++;
				}
				if (!selectedPost) {
					break;
				}
				mixedPosts.push(selectedPost);
				externalScore += nativeWeight;
			} else {
				mixedPosts.push(localWithFlag[nativeIndex++]);
				nativeScore += externalWeight;
			}
		}
		// Take only the requested amount after mixing
		const posts = mixedPosts.slice(0, backendFetchTotal);
		//console.log(`[EXPLORE ALGORITHM] After mixing: ${mixedPosts.length} total, returning ${posts.length} posts`);
		//console.log(`[EXPLORE ALGORITHM] Mix breakdown: ${posts.filter(p => !p.isExternal).length} native, ${posts.filter(p => p.isExternal).length} external`);
		return posts;
	}
}
