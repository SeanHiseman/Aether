import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { excludedAttrs } from "./algorithmFunctions/stripExcludedAttributes.js";
import { ExternalPosts, ExternalPostVotes } from "../models/content.js";
import { FEED_CONFIG } from "../routes/socialConnect.js";
import { fetchPaginatedPostData } from "./algorithmFunctions/fetchPaginatedPostData.js";
import { formatExternalPost } from "../functions/external_posts/formatExternalPost.js";
import { IntermixArrays } from "../functions/intermixArrays.js";
import { Op } from 'sequelize';
import { processAccount } from "../functions/external_posts/processAccount.js";
import { scoreAndPaginateCandidates } from "./algorithmFunctions/scoreAndPaginateCandidates.js";
import Sequelize, { QueryTypes } from 'sequelize';
import sequelize from "../databaseSetup.js";
import { stripExcludedAttributes } from "./algorithmFunctions/stripExcludedAttributes.js";

async function ApplyAlgorithm({ locationId, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit = 100, offset, recentUpvotes, viewerId, keyword = '', connectedAccounts = [], userId }) {
	try {
        //Followed feeds are a received as a string
		const followedFeedIdsSafe = (typeof followedFeedIds === "string")
			? followedFeedIds.split(",")
			: (Array.isArray(followedFeedIds) ? followedFeedIds : []);

        //Find if there is an algorithm applied at this location
		let algorithm = {};
		let algorithmLocation = null;
		let algorithmRow = null;
		if (viewerId && locationId) {
			const normLocationId = locationId.replace(/^deep_/, '');
			algorithmLocation = await AlgorithmLocations.findOne({
				where: { location_id: normLocationId, viewer_id: viewerId },
				raw: true
			});
			//For individual external accounts, also check for algorithm on the parent platform
			if (!algorithmLocation && normLocationId.startsWith('external_account_')) {
				const parts = normLocationId.replace('external_account_', '').split('_');
				const platform = parts[0]; //e.g., 'bluesky'
				algorithmLocation = await AlgorithmLocations.findOne({
					where: { location_id: platform, viewer_id: viewerId },
					raw: true
				});
			}
			if (algorithmLocation) {
				algorithmRow = await Algorithms.findOne({
					attributes: ['algorithm_code', 'boost_embedding', 'suppress_embedding'],
					where: { algorithm_id: algorithmLocation.algorithm_id },
					raw: true
				});
				if (algorithmRow) {
                    try {
                        algorithm = JSON.parse(algorithmRow.algorithm_code);
                    } catch (error) {
                        algorithm = {};
                    }
				}
			}
		}

        //Check if algorithm is active today
		let isActiveToday = true;
		if (algorithmLocation) {
			const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
		}

		const { chronology = 0, contentType = {}, variety = 1, wordLimits = {}, videoLimits = {}, timeLimits = {}, scoring = {} } = algorithm;
		const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;
		const lowVoteImpact = voteImpact < 0.3;
		const highChronology = chronology > 0.7;
        const useChronological = (!isGroup && !algorithmLocation) || (!isActiveToday && !isGroup);
		const useStandardScore = ((!algorithmLocation && isGroup) || (!isActiveToday && isGroup));
		const hasActiveAlgorithm = algorithmLocation && isActiveToday;

        //Decide whether to fetch with all attributes or exclude them up front
		const fetchFullAttributes = !useChronological && !useStandardScore;
		const attrOption = fetchFullAttributes ? undefined : { exclude: excludedAttrs };
		const backendFetchTotal = (useChronological || useStandardScore) ? limit : Math.max(limit, 100);
		const orderMode = (highChronology || lowVoteImpact ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']]);

        //Collect recent upvoted posts for similarity comparison
		let recentUpvoteIds = [];
		let recentUpvotePosts = [];
		let normalisedRecentEmbeddings = [];
		if (algorithmLocation) {
			if (viewerId && !recentUpvotes) {
				const foundRecentUpvotes = await PostVotes.findAll({
					attributes: ['post_id'],
					where: {
						voter_id: viewerId,
						upvotes: { [Op.gt]: 0 },
						downvotes: { [Op.lte]: 0 }
					},
					order: [['updated_at', 'DESC']],
					limit: limit,
					raw: true
				});
				recentUpvoteIds = foundRecentUpvotes.map(row => row.post_id);
			} else if (recentUpvotes) {
				recentUpvoteIds = recentUpvotes.map(row => row.post_id);
			}
			if (recentUpvoteIds.length > 0) {
				recentUpvotePosts = await Posts.findAll({
					attributes: ['embeddings', 'updated_at'],
					where: { post_id: { [Op.in]: recentUpvoteIds } },
					raw: true
				});
				const recentUpvoteEmbeddings = recentUpvotePosts.map(p => {
					const raw = p.embeddings;
					if (!raw) return null;
					if (typeof raw === 'string') {
						try {
							const parsed = JSON.parse(raw);
							return Array.isArray(parsed) ? parsed : null;
						} catch (error) {
							return null;
						}
					}
					return Array.isArray(raw) ? raw : null;
				}).filter(Boolean);
				normalisedRecentEmbeddings = recentUpvoteEmbeddings.map(vec => {
					const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
					return vec.map(v => v / mag);
				});
			}
		}

		const scoringParams = { voteImpact, sentiment, variety, normalisedRecentEmbeddings, recentUpvotePosts, timeLimits };

		//Algorithm filters for native Posts
		const algorithmFilters = {};
		if (hasActiveAlgorithm) {
			if (contentType.images === false) algorithmFilters.has_images = false;
			if (contentType.videos === false) algorithmFilters.has_videos = false;
			if (contentType.text === false) algorithmFilters.has_text = false;
			if (contentType.interactive === false) algorithmFilters.has_interactive = false;
			if (Number.isFinite(wordLimits.min)) {
				algorithmFilters.word_count = { [Op.gte]: wordLimits.min };
				algorithmFilters.has_text = true;
			}
			if (Number.isFinite(wordLimits.max)) {
				algorithmFilters.word_count = {
					...algorithmFilters.word_count,
					[Op.lte]: wordLimits.max
				};
				algorithmFilters.has_text = true;
			}
			if (Number.isFinite(videoLimits.min)) {
				algorithmFilters.video_length = { [Op.gte]: videoLimits.min };
				algorithmFilters.has_videos = true;
			}
			if (Number.isFinite(videoLimits.max)) {
				algorithmFilters.video_length = {
					...algorithmFilters.video_length,
					[Op.lte]: videoLimits.max
				};
				algorithmFilters.has_videos = true;
			}
		}

		//Algorithm filters for ExternalPosts (SQL string)
		let externalFiltersSQL = '';
		if (hasActiveAlgorithm) {
			const conditions = [];
			if (contentType.images === false) conditions.push('p.has_images = false');
			if (contentType.text === false) conditions.push('p.has_text = false');
			if (Number.isFinite(wordLimits.min)) conditions.push(`(p.has_text = false OR p.word_count >= ${wordLimits.min})`);
			if (Number.isFinite(wordLimits.max)) conditions.push(`(p.has_text = false OR p.word_count <= ${wordLimits.max})`);
			if (conditions.length > 0) {
				externalFiltersSQL = 'AND ' + conditions.join(' AND ');
			}
		}

		const MAX_ALGORITHM_CANDIDATES = 500;

        //Fetch posts according to location
        let posts = [];
		if (locationId === "search" && keyword) {
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
				posts = await fetchPaginatedPostData({ 
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
					const rawExternal = await ExternalPosts.findAll({
						where: { post_id: externalIds, content: { [Op.ne]: null } },
						raw: true
					});
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
				posts = allPosts.sort((a, b) => {
					const idA = a.post_id;
					const idB = b.post_id;
					return orderMap.get(idA) - orderMap.get(idB);
				});
			} 
		} else if (locationId === "following") {
			const hasExternalSources = connectedAccounts.length > 0;
			if (hasActiveAlgorithm) {
				//Algorithm path: fetch all candidates, score, then paginate
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						feed_id: { [Op.in]: followedFeedIdsSafe },
						parent_id: null,
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
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path with source mixing
				const halfLimit = Math.ceil(backendFetchTotal / 2);
				const halfOffset = Math.floor(offset / 2);
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: {
						...algorithmFilters,
						feed_id: { [Op.in]: followedFeedIdsSafe },
						parent_id: null,
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
				}
				const formattedExternal = externalPosts.map(p => formatExternalPost(p, FEED_CONFIG[p.source], p.source));
				const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
				const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
				posts = [...localWithFlag, ...externalWithFlag].slice(0, backendFetchTotal);
			}
		} else if (typeof locationId === 'string' && locationId.startsWith('external_account_')) {
			//Individual external account (e.g., external_account_bluesky_did:plc:xxx)
			const parts = locationId.replace('external_account_', '').split('_');
			const platform = parts[0];
			const accountId = parts.slice(1).join('_'); //Handle DIDs with underscores
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
				//console.log("scoreAndPaginateCandidates result:", { paginatedIds, scoreMap });
				if (!paginatedIds.length) {
					if (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL) {
						return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
					}
					return { posts: [], status: "ok", message: "" };
				}
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				//Search by both author_did and author (handle) for robustnessThe 
				const rawExternal = await ExternalPosts.findAll({
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
				posts = rawExternal.map(p => ({
					...formatExternalPost(p, FEED_CONFIG[platform], platform),
					isExternal: true
				}));
			}
		} else if (typeof locationId === 'string' && ['reddit','bluesky','mastodon'].includes(locationId)) {
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
					if (!externalPostIds.length && connectedAccounts?.length) {
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
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				let accesses = [];
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
				if (!accesses.length && connectedAccounts?.length) {
					const account = connectedAccounts.find(a => a.platform === platform);
					if (account) {
						await processAccount({
							platform,
							user_id: userId,
							access_token: account.access_token,
							instance_url: account.instance_url
						}).catch(() => null);
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
				}
				const unifiedIds = accesses.map(a => a.post_id).filter(Boolean);
				let externalPosts = [];
				if (unifiedIds.length) {
					externalPosts = await ExternalPosts.findAll({
						where: { post_id: unifiedIds, source: platform, content: { [Op.ne]: null } },
						raw: true
					});
				}
				posts = externalPosts.map(p => ({
					...formatExternalPost(p, FEED_CONFIG[platform], p.source),
					isExternal: true
				}));
			}
        } else if (locationId === "explore") {
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
				//Fetch hottest external posts from all platforms (same for all users)
				//Use 3 day window for explore feed to heavily favor recent posts
				const externalPostsQuery = await sequelize.query(
					`SELECT p.post_id FROM external_posts p
					WHERE p.source IN ('reddit', 'bluesky', 'mastodon') AND p.expired = false
					AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 3 DAY) ${externalFiltersSQL}
					ORDER BY (p.score * EXP(-0.00005 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
					LIMIT :maxCandidates`,
					{ replacements: { maxCandidates: MAX_ALGORITHM_CANDIDATES }, type: QueryTypes.SELECT }
				);
				const externalPostIds = externalPostsQuery.map(a => a.post_id);
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
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path with mixed native and external posts
				//Soft 2:3 preference, interspersed, balanced external sources with graceful degradation
				const nativeTarget = Math.ceil((backendFetchTotal / 5) * 2);
				const externalTarget = Math.ceil((backendFetchTotal / 5) * 3);
				const nativeOffset = Math.floor((offset / 5) * 2);
				const externalOffset = Math.floor((offset / 5) * 3);
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
				//Fetch equal amounts from each platform
				const perPlatformTarget = Math.ceil(externalTarget / 3);
				const perPlatformOffset = Math.floor(externalOffset / 3);
				const platformQueries = ['bluesky', 'reddit', 'mastodon'].map(platform =>
					sequelize.query(
						`SELECT p.post_id, p.source FROM external_posts p
						WHERE p.source = :platform AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 3 DAY) ${externalFiltersSQL}
						ORDER BY ${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00005 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
						LIMIT :limit OFFSET :offset`,
						{ replacements: { platform, limit: perPlatformTarget, offset: perPlatformOffset }, type: QueryTypes.SELECT }
					)
				);
				const platformResults = await Promise.all(platformQueries);
				const externalAccesses = platformResults.flat();
				const unifiedIds = externalAccesses.map(a => a.post_id);
				let externalPosts = [];
				if (unifiedIds.length) {
					externalPosts = await ExternalPosts.findAll({
						where: { post_id: unifiedIds, content: { [Op.ne]: null } },
						raw: true
					});
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
				posts = mixedPosts.slice(0, backendFetchTotal);
			}
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
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
							feed_id: { [Op.in]: allFeedIds },
							parent_id: null,
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
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
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
							feed_id: { [Op.in]: allFeedIds },
							parent_id: null,
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
				posts = IntermixArrays(localWithFlag, externalWithFlag).slice(0, backendFetchTotal);
			}
        } else {
            //Default: channels and main feeds
            const channelOrderMode = useChronological ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']];
			const whereClause = {
				...algorithmFilters,
				...(!isMain && locationId ? { channel_id: locationId } : {}),
				...(isMain && feedId && !isGroup ? { poster_id: feedId } : {}),
				...(isMain && isGroup ? { feed_id: feedId } : {}),
				...(isMain ? {
					[Op.or]: [
						{ is_private: false },
						...(feedId ? [{ feed_id: feedId }] : [])
					]
				} : {}),
				parent_id: null,
			};
			if (hasActiveAlgorithm) {
				//Algorithm path
				const nativePostIds = await Posts.findAll({
					attributes: ['post_id'],
					where: whereClause,
					order: [['created_at', 'DESC']],
					limit: MAX_ALGORITHM_CANDIDATES,
					raw: true
				});
				const { paginatedIds, scoreMap } = await scoreAndPaginateCandidates({
					nativePostIds: nativePostIds.map(p => p.post_id),
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
				posts = await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
			} else {
				//Standard path
				const postIds = await Posts.findAll({
					attributes: ['post_id'],
					where: whereClause,
					order: channelOrderMode,
					limit: backendFetchTotal,
					offset,
					raw: true
				});
				const orderedIds = postIds.map(p => p.post_id);
				posts = await Posts.findAll({
					where: { post_id: orderedIds },
					include: includeOptions,
					attributes: attrOption,
					raw: false
				});
				const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
				posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
			}
        }

        if (!posts.length) {
			if (hasActiveAlgorithm && (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL)) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}

		//Check if posts already have algorithmScore (from algorithm path)
		const postsAlreadyScored = posts.length > 0 && typeof posts[0].algorithmScore === 'number';

		//For non-algorithm paths that still need standard score processing
		if (!postsAlreadyScored && (useChronological || useStandardScore)) {
			//Intermix for "following" feed before returning
			if (locationId === "following" && posts.some(p => p.isExternal === true) && posts.some(p => p.isExternal === false)) {
				const nativePosts = posts.filter(p => p.isExternal === false);
				const externalPosts = posts.filter(p => p.isExternal === true);
				posts = IntermixArrays(nativePosts, externalPosts);
			}
			const ids = posts.map(p => p.post_id);
			const nativeIds = posts.filter(p => !p.isExternal).map(p => p.post_id);
			const externalIds = posts.filter(p => p.isExternal).map(p => p.post_id);
			const [userVotes, externalVotes, savedRows] = viewerId
				? await Promise.all([
					nativeIds.length ? PostVotes.findAll({
						attributes: ['post_id', 'upvotes', 'downvotes'],
						where: { post_id: { [Op.in]: nativeIds }, voter_id: viewerId },
						raw: true
					}) : Promise.resolve([]),
					externalIds.length ? ExternalPostVotes.findAll({
						attributes: ['post_id', 'vote_type'],
						where: { post_id: { [Op.in]: externalIds }, user_id: userId },
						raw: true
					}) : Promise.resolve([]),
					SavedPosts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: ids }, saver_id: viewerId },
						raw: true
					})
				])
				: [[], [], []];
			const voteMap = new Map(
				userVotes.map(v => [v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }])
			);
			const externalVoteMap = new Map(externalVotes.map(v => [v.post_id, {
				has_upvoted: v.vote_type === 'upvote' || v.vote_type === 'like',
				has_downvoted: v.vote_type === 'downvote'
			}]));
			const savedSet = new Set(savedRows.map(s => s.post_id));
			return {
				posts: stripExcludedAttributes(
					posts.map(p => {
						const isExternal = p.isExternal || p.is_external;
						const votes = isExternal
							? (externalVoteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false })
							: (voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false });
						return {
							...(p.dataValues || p),
							...votes,
							is_saved: savedSet.has(p.post_id)
						};
					})
				),
				status: "ok"
			};
		}
		const finalIds = posts.map(p => p.post_id);
		//Separate native and external post IDs for vote lookup
		const nativeIds = posts.filter(p => !p.isExternal).map(p => p.post_id);
		const externalIds = posts.filter(p => p.isExternal).map(p => p.post_id);
		const [userVotes, externalVotes, savedRows] = viewerId
			? await Promise.all([
				nativeIds.length ? PostVotes.findAll({
					attributes: ['post_id', 'upvotes', 'downvotes'],
					where: { post_id: { [Op.in]: nativeIds }, voter_id: viewerId },
					raw: true
				}) : Promise.resolve([]),
				externalIds.length ? ExternalPostVotes.findAll({
					attributes: ['post_id', 'vote_type'],
					where: { post_id: { [Op.in]: externalIds }, user_id: userId },
					raw: true
				}) : Promise.resolve([]),
				SavedPosts.findAll({
					attributes: ['post_id'],
					where: { post_id: { [Op.in]: finalIds }, saver_id: viewerId },
					raw: true
				})
			])
			: [[], [], []];
		//Native post votes map
		const voteMap = new Map(userVotes.map(v => [
			v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }
		]));
		//External post votes map (convert vote_type to has_upvoted/has_downvoted)
		const externalVoteMap = new Map(externalVotes.map(v => {
			//For Reddit, map upvote/downvote to the respective flags
			//For Bluesky/Mastodon, only has_upvoted is used (vote_type === 'like')
			return [v.post_id, {
				has_upvoted: v.vote_type === 'upvote' || v.vote_type === 'like',
				has_downvoted: v.vote_type === 'downvote'
			}];
		}));
		const savedSet = new Set(savedRows.map(s => s.post_id));
		const postsWithVotes = posts.map(p => {
			const isExternal = p.isExternal || p.is_external;
			const votes = isExternal
				? (externalVoteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false })
				: (voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false });
			return {
				...(p.dataValues || p),
				...votes,
				is_saved: savedSet.has(p.post_id)
			};
		});
		return { posts: stripExcludedAttributes(postsWithVotes), status: "ok", message: "" };
	} catch (error) {
		console.error(new Date().toISOString(), 'Error in ApplyAlgorithm:', error);
		return { posts: [], status: "error", message: "" };
	}
}

export { ApplyAlgorithm };