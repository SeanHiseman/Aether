import { ExternalPosts } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { attachQuotedExternalPosts, formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Op } from 'sequelize';
import { processAccount } from "../../functions/external_posts/processAccount.js";
import { QueryTypes } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";
import sequelize from "../../databaseSetup.js";

export async function fetchPlatformPosts({ locationId, userId, connectedAccounts, hasActiveAlgorithm, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams }) {
	const platform = locationId;
	if (hasActiveAlgorithm) {
		//Algorithm path for external platform feeds
		let externalPostIds = [];
		if (userId) {
			const accesses = await sequelize.query(
				`SELECT p.post_id FROM external_posts_access a
				JOIN external_posts p ON p.post_id = a.post_id
				WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
				AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
				ORDER BY p.created_at_remote DESC
				LIMIT :maxCandidates`,
				{ replacements: { userId, platform, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
			);
			externalPostIds = accesses.map(a => a.post_id);
			// Fetch from API if we don't have enough candidates
			if (externalPostIds.length < MAX_ALGORITHM_CANDIDATES && connectedAccounts?.length) {
				const account = connectedAccounts.find(a => a.platform === platform);
				if (account) {
					await processAccount({
						platform,
						user_id: userId,
						access_token: account.access_token,
						instance_url: account.instance_url
					}).catch(() => null);
					const retryAccesses = await sequelize.query(
						`SELECT p.post_id FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
						ORDER BY p.created_at_remote DESC
						LIMIT :maxCandidates`,
						{ replacements: { userId, platform, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
					);
					externalPostIds = retryAccesses.map(a => a.post_id);
				}
			}
		}
		const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
			externalPostIds,
			algorithmRow,
			scoringParams,
			offset,
			limit
		});
		if (!paginatedIds.length) return { posts: [], status: "ok", message: "" };
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
	} else {
		//Standard path
		let accesses = [];
		let fetchedFromApi = false;

		if (userId) {
			accesses = await sequelize.query(
				`SELECT p.post_id FROM external_posts_access a
				JOIN external_posts p ON p.post_id = a.post_id
				WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
				AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
				ORDER BY (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
				LIMIT :limit OFFSET :offset`,
				{ replacements: { limit: backendFetchTotal, offset, platform, userId }, type: QueryTypes.SELECT }
			);
		}

		// Fetch from API when we got less than requested (database is running out)
		if (accesses.length < backendFetchTotal && connectedAccounts?.length) {
			const account = connectedAccounts.find(a => a.platform === platform);
			if (account) {
				const countBefore = await sequelize.query(
					`SELECT COUNT(*) as count FROM external_posts_access WHERE user_id = :userId AND source = :platform`,
					{ replacements: { userId, platform }, type: QueryTypes.SELECT }
				);
				const beforeCount = countBefore[0].count;

				await processAccount({
					platform,
					user_id: userId,
					access_token: account.access_token,
					instance_url: account.instance_url
				}).catch(() => null);

				const countAfter = await sequelize.query(
					`SELECT COUNT(*) as count FROM external_posts_access WHERE user_id = :userId AND source = :platform`,
					{ replacements: { userId, platform }, type: QueryTypes.SELECT }
				);
				const afterCount = countAfter[0].count;

				fetchedFromApi = afterCount > beforeCount;

				// After fetching, query again from offset 0 to get all posts, then slice
				// This handles newly fetched posts being sorted into the list
				const allAccesses = await sequelize.query(
					`SELECT p.post_id FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE a.user_id = :userId AND a.source = :platform AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
					ORDER BY (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
					LIMIT :limit OFFSET 0`,
					{ replacements: { limit: offset + backendFetchTotal, platform, userId }, type: QueryTypes.SELECT }
				);
				// Slice to get the current page
				accesses = allAccesses.slice(offset, offset + backendFetchTotal);
			}
		}
		const unifiedIds = accesses.map(a => a.post_id).filter(Boolean);
		let externalPosts = [];
		if (unifiedIds.length) {
			externalPosts = await ExternalPosts.findAll({
				where: { post_id: unifiedIds, source: platform, content: { [Op.ne]: null } },
				raw: true
			});
			externalPosts = await attachQuotedExternalPosts(externalPosts);
		}
		return externalPosts.map(p => ({
			...formatExternalPost(p, FEED_CONFIG[platform], p.source),
			isExternal: true
		}));
	}
}