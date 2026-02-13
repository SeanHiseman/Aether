import { ExternalAccountMeta, ExternalPosts } from "../../models/content.js";
import { ensureExternalAccountPosts } from "../../functions/external_posts/ensureExternalAccountPosts.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { attachQuotedExternalPosts, formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Op } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";

export async function fetchExternalAccountPosts({ locationId, userId, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams }) {
	//Individual external account (e.g., external_account_bluesky_did:plc:xxx)
	const parts = locationId.replace('external_account_', '').split('_');
	const platform = parts[0];
	const accountId = parts.slice(1).join('_'); //Handle DIDs with underscores
	//Check if posts are stale and fetch from API if needed
	if (userId && ['bluesky', 'mastodon'].includes(platform)) {
		const accountMeta = await ExternalAccountMeta.findOne({
			where: {
				platform,
				[Op.or]: [{ account_id: accountId }, { handle: accountId }]
			},
			attributes: ['last_fetched_at', 'cursor', 'account_id', 'handle'],
			raw: true
		});
		const FIVE_MINUTES = 5 * 60 * 1000;
		const isStale = !accountMeta?.last_fetched_at ||
			(Date.now() - new Date(accountMeta.last_fetched_at).getTime()) > FIVE_MINUTES;
		const authorHandle = accountMeta?.handle || accountId;
		const authorDid = accountMeta?.account_id || accountId;
		//If first page and stale, fetch latest posts from API
		if (offset === 0 && isStale) {
			await ensureExternalAccountPosts(userId, platform, authorHandle, authorDid, null, null);
		}
		//If paginating beyond DB content, fetch more using cursor
		//Re-read meta after potential fresh fetch above to get updated cursor
		if (offset > 0) {
			const dbPostCount = await ExternalPosts.count({
				where: {
					source: platform,
					[Op.or]: [{ author_did: accountId }, { author: accountId }],
					expired: false,
					content: { [Op.ne]: null }
				}
			});
			if (offset + limit > dbPostCount) {
				const freshMeta = await ExternalAccountMeta.findOne({
					where: { platform, [Op.or]: [{ account_id: accountId }, { handle: accountId }] },
					attributes: ['cursor'],
					raw: true
				});
				if (freshMeta?.cursor) {
					await ensureExternalAccountPosts(userId, platform, authorHandle, authorDid, freshMeta.cursor, null);
				}
			}
		}
	}
	if (hasActiveAlgorithm) {
		//Algorithm path for individual external account
		//Search by both author_did and author (handle) for robustness
		const externalPosts = await ExternalPosts.findAll({
			attributes: ['post_id'],
			where: {
				source: platform,
				[Op.or]: [{ author_did: accountId }, { author: accountId }],
				expired: false,
				content: { [Op.ne]: null }
			},
			order: [['created_at_remote', 'DESC']],
			limit: MAX_ALGORITHM_CANDIDATES,
			raw: true
		});
		const externalPostIds = externalPosts.map(p => p.post_id);
		const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
			externalPostIds,
			algorithmRow,
			scoringParams,
			offset,
			limit
		});
		if (!paginatedIds.length) {
			if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
	} else {
		//Standard path
		//Search by both author_did and author (handle) for robustnessThe
		let rawExternal = await ExternalPosts.findAll({
			where: {
				source: platform,
				[Op.or]: [{ author_did: accountId }, { author: accountId }],
				expired: false,
				content: { [Op.ne]: null }
			},
			order: [['created_at_remote', 'DESC']],
			limit: backendFetchTotal,
			offset,
			raw: true
		});
		rawExternal = await attachQuotedExternalPosts(rawExternal);
		return rawExternal.map(p => ({
			...formatExternalPost(p, FEED_CONFIG[platform], platform),
			isExternal: true
		}));
	}
}