import { ExternalPosts } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { attachQuotedExternalPosts, formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Feeds, Posts, Reposts } from "../../models/relationships.js";
import { Op } from 'sequelize';
import { processAccount } from "../../functions/external_posts/processAccount.js";
import { QueryTypes } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";
import sequelize from "../../databaseSetup.js";

export async function fetchFollowingPosts({ followedFeedIdsSafe, viewerId, userId, connectedAccounts, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, lowVoteImpact, algorithmRow, scoringParams }) {
	const hasExternalSources = connectedAccounts.length > 0;
	//Identify followed user feeds to fetch their posts/replies on any feed
	let followedUserFeedIds = [];
	if (followedFeedIdsSafe.length > 0) {
		const feedInfo = await Feeds.findAll({
			attributes: ['feed_id'],
			where: { feed_id: { [Op.in]: followedFeedIdsSafe }, is_group: false },
			raw: true
		});
		followedUserFeedIds = feedInfo.map(f => f.feed_id);
	}
	//Top-level posts on followed feeds + all posts/replies by followed users on any feed
	const feedConditions = [];
	if (followedFeedIdsSafe.length > 0) feedConditions.push({ feed_id: { [Op.in]: followedFeedIdsSafe }, parent_id: null });
	if (followedUserFeedIds.length > 0) feedConditions.push({ poster_id: { [Op.in]: followedUserFeedIds } });
	const feedFilter = feedConditions.length === 1 ? feedConditions[0] : { [Op.or]: feedConditions };
	if (hasActiveAlgorithm) {
		//Algorithm path: fetch all candidates, score, then paginate
		const nativePostIds = await Posts.findAll({
			attributes: ['post_id'],
			where: {
				...algorithmFilters,
				...feedFilter,
				...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
			},
			order: [['created_at', 'DESC']],
			limit: MAX_ALGORITHM_CANDIDATES,
			raw: true
		});
		let externalPostIds = [];
		if (hasExternalSources) {
			const externalAccesses = await sequelize.query(
				`SELECT p.post_id FROM external_posts_access a
				JOIN external_posts p ON p.post_id = a.post_id
				WHERE a.user_id = :userId AND p.expired = false
				AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
				ORDER BY p.created_at_remote DESC
				LIMIT :maxCandidates`,
				{ replacements: { userId, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
			);
			if (!externalAccesses.length && offset === 0) {
				await Promise.all(connectedAccounts.map(account =>
					processAccount({
						platform: account.platform,
						user_id: userId,
						access_token: account.access_token,
						instance_url: account.instance_url
					}).catch(() => null)
				));
				const retryAccesses = await sequelize.query(
					`SELECT p.post_id FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE a.user_id = :userId AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
					ORDER BY p.created_at_remote DESC
					LIMIT :maxCandidates`,
					{ replacements: { userId, maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
				);
				externalPostIds = retryAccesses.map(a => a.post_id);
			} else {
				externalPostIds = externalAccesses.map(a => a.post_id);
			}
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
			if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
	} else {
		//Standard path with source mixing
		const halfLimit = Math.ceil(backendFetchTotal / 2);
		const halfOffset = Math.floor(offset / 2);
		const postIds = await Posts.findAll({
			attributes: ['post_id'],
			where: {
				...algorithmFilters,
				...feedFilter,
				...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
			},
			order: orderMode,
			limit: hasExternalSources ? halfLimit : backendFetchTotal,
			offset: hasExternalSources ? halfOffset : offset,
			raw: true
		});
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
		let externalAccesses = [];
		if (hasExternalSources) {
			externalAccesses = await sequelize.query(
				`SELECT p.post_id FROM external_posts_access a
				JOIN external_posts p ON p.post_id = a.post_id
				WHERE a.user_id = :userId AND p.expired = false
				AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
				ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
				LIMIT :limit OFFSET :offset`,
				{ replacements: { limit: halfLimit, offset: halfOffset, userId }, type: QueryTypes.SELECT }
			);
			if (!externalAccesses.length && offset === 0) {
				await Promise.all(connectedAccounts.map(account =>
					processAccount({
						platform: account.platform,
						user_id: userId,
						access_token: account.access_token,
						instance_url: account.instance_url
					}).catch(() => null)
				));
				externalAccesses = await sequelize.query(
					`SELECT p.post_id FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE a.user_id = :userId AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${externalFiltersSQL}
					ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
					LIMIT :limit OFFSET :offset`,
					{ replacements: { limit: halfLimit, offset: halfOffset, userId }, type: QueryTypes.SELECT }
				);
			}
		}
		const unifiedIds = externalAccesses.map(a => a.post_id);
		let externalPosts = [];
		if (unifiedIds.length) {
			externalPosts = await ExternalPosts.findAll({
				where: { post_id: unifiedIds, content: { [Op.ne]: null } },
				raw: true
			});
			externalPosts = await attachQuotedExternalPosts(externalPosts);
		}
		const formattedExternal = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[p.source], p.source));
		const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
		const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
		let posts = [...localWithFlag, ...externalWithFlag].slice(0, backendFetchTotal);
		//Fetch reposts from followed users
		if (followedFeedIdsSafe.length > 0) {
			try {
				const reposts = await Reposts.findAll({
					where: { reposter_id: { [Op.in]: followedFeedIdsSafe } },
					order: [['created_at', 'DESC']],
					limit: backendFetchTotal,
					offset: 0,
					include: [
						{
							model: Feeds,
							as: 'reposter',
							attributes: ['feed_id', 'feed_name', 'feed_photo']
						}
					],
					raw: false
				});
				//Separate native and external reposts
				const nativeRepostIds = reposts.filter(r => !r.is_external).map(r => r.post_id);
				const externalRepostIds = reposts.filter(r => r.is_external).map(r => r.post_id);
				//Fetch native posts for native reposts
				let nativeRepostPosts = [];
				if (nativeRepostIds.length > 0) {
					const nativePosts = await Posts.findAll({
						where: { post_id: { [Op.in]: nativeRepostIds } },
						include: includeOptions,
						attributes: attrOption,
						raw: false
					});
					//Map posts with repost data
					nativeRepostPosts = nativePosts.map(post => {
						const repostData = reposts.find(r => r.post_id === post.post_id);
						const reposterData = repostData?.reposter?.dataValues || repostData?.reposter;
						return {
							...(post.dataValues || post),
							is_repost: true,
							reposted_at: repostData?.created_at,
							reposted_by: repostData?.reposter_id,
							reposted_by_name: reposterData?.feed_name || 'Unknown'
						};
					});
				}
				//Fetch external posts for external reposts
				let externalRepostPosts = [];
				if (externalRepostIds.length > 0) {
					let rawExternal = await ExternalPosts.findAll({
						where: { post_id: { [Op.in]: externalRepostIds }, content: { [Op.ne]: null } },
						raw: true
					});
					rawExternal = await attachQuotedExternalPosts(rawExternal);
					externalRepostPosts = rawExternal.map(p => {
						const platformConfig = FEED_CONFIG[p.source];
						const repostData = reposts.find(r => r.post_id === p.post_id);
						const reposterData = repostData?.reposter?.dataValues || repostData?.reposter;
						return {
							...formatExternalPost(p, platformConfig, p.source),
							is_external: true,
							isExternal: true,
							is_repost: true,
							reposted_at: repostData?.created_at,
							reposted_by: repostData?.reposter_id,
							reposted_by_name: reposterData?.feed_name || 'Unknown'
						};
					});
				}
				//Merge reposts with regular posts, skipping duplicates
				const existingPostIds = new Set(posts.map(p => p.post_id));
				const uniqueReposts = [...nativeRepostPosts, ...externalRepostPosts].filter(p => !existingPostIds.has(p.post_id));
				posts = [...posts, ...uniqueReposts];
				//Sort by creation/repost time
				posts.sort((a, b) => {
					const aTime = a.reposted_at || a.created_at || a.created_at_remote;
					const bTime = b.reposted_at || b.created_at || b.created_at_remote;
					return new Date(bTime) - new Date(aTime);
				});
				//Limit to backendFetchTotal
				posts = posts.slice(0, backendFetchTotal);
			} catch (error) {
				console.error('Error fetching reposts for following feed:', error);
				//Continue without reposts if there's an error
			}
		}
		return posts;
	}
}