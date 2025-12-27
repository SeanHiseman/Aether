import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { CosineSimilarity } from "../functions/calculation/cosineSimilarity.js";
import { DeepFeedContent, Posts, PostVotes, SavedPosts } from "../models/relationships.js";
import { ExternalPosts, ExternalPostsAccess } from "../models/content.js";
import { FEED_CONFIG, formatExternalPost, processAccount } from "../routes/socialConnect.js";
import { IntermixArrays } from "../functions/intermixArrays.js";
import { Op } from 'sequelize';
import Sequelize, { QueryTypes } from 'sequelize';
import sequelize from "../databaseSetup.js";

const excludedAttrs = [
	'rank_hotness',
	'rank_updated_at',
    'text_body',
    'text_length',
    'word_count',
    'video_length',
    'sentence_count',
    'has_images',
    'has_videos',
    'has_interactive',
    'has_external_posts',
    'has_embedded_websites',
    'has_text',
    'image_count',
    'video_count',
    'sentiment_score',
    'language',
    'tokens',
    'embeddings'
];

function stripExcludedAttributes(posts) {
	return posts.map(p => {
		const obj = p.dataValues ? { ...p.dataValues } : { ...p };
		excludedAttrs.forEach(attr => delete obj[attr]);
		return obj;
	});
}

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
		//let isActiveToday = false;
		let isActiveToday = true;
		if (algorithmLocation) {
			const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            isActiveToday = algorithm.activeDays && algorithm.activeDays.length > 0 ? algorithm.activeDays.map(d => d.toLowerCase()).includes(today) : true;
		}

		const { chronology = 0, contentType = {}, variety = 1, wordLimits = {}, videoLimits = {}, timeLimits = {}, dateLimits = {}, scoring = {} } = algorithm;
		const { sentiment = 0, voteImpact = 1, wordBoost = [], wordSuppress = [] } = scoring;
		const lowVoteImpact = voteImpact < 0.3; //When voteImpact is low, don't order by score/hotness
		const highChronology = chronology > 0.7; //When chronology is high, prioritize recency
        const useChronological = (!isGroup && !algorithmLocation) || (!isActiveToday && !isGroup); //User feeds without active algorithms, high chronology, or low voteImpact should be in time order
		const useStandardScore = ((!algorithmLocation && isGroup) || (!isActiveToday && isGroup));

        //Decide whether to fetch with all attributes or exclude them up front
		const fetchFullAttributes = !useChronological && !useStandardScore;

        //Collect recent upvoted posts for similarity comparison from local storage or database
		let recentUpvoteIds = [];
		let recentUpvoteEmbeddings = [];
		let recentUpvotePosts = [];
		let normalisedRecentEmbeddings = [];
		if (algorithmLocation) { //Only need recent votes if there's an algorithm
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
				recentUpvoteEmbeddings = recentUpvotePosts.map(p => {
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
			}
			normalisedRecentEmbeddings = recentUpvoteEmbeddings.map(vec => {
				const mag = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
				return vec.map(v => v / mag);
			});
		}

        //Fetch posts according to location
        let posts = [];
        const attrOption = fetchFullAttributes ? undefined : { exclude: excludedAttrs };
		//console.log("limit:", limit);
		//console.log("useChronological:", useChronological);
		//console.log("useStandardScore:", useStandardScore);
		const backendFetchTotal = (useChronological || useStandardScore) ? limit : Math.max(limit, 100); //Fetch more posts from DB to allow for filtering later
		//console.log("backendFetchTotal:", backendFetchTotal);
		const orderMode = (highChronology || lowVoteImpact ? [['created_at', 'DESC']] : [['rank_hotness', 'DESC']]);

		//Algorithm filters for native Posts
		const algorithmFilters = {};
		if (algorithmLocation && isActiveToday) {
			if (contentType.images === false) algorithmFilters.has_images = false;
			if (contentType.videos === false) algorithmFilters.has_videos = false;
			if (contentType.text === false) algorithmFilters.has_text = false;
			    if (contentType.interactive === false) {
					algorithmFilters.has_interactive = false;
					algorithmFilters.has_external_posts = false;
					algorithmFilters.has_embedded_websites = false;
				}
			//Word limits only apply if has_text = true
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
			//Video length limits only apply if has_videos = true
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
			//Date filters
			if (dateLimits.from) {
				algorithmFilters.created_at = { [Op.gte]: new Date(dateLimits.from) };
			}
			if (dateLimits.to) {
				algorithmFilters.created_at = { 
					...algorithmFilters.created_at,
					[Op.lte]: new Date(dateLimits.to)
				};
			}
		}
		//console.log("algorithmFilters:", algorithmFilters);
		//Algorithm filters for ExternalPosts
		let externalFiltersSQL = '';
		if (algorithmLocation && isActiveToday) {
			const conditions = [];
			if (contentType.images === false) conditions.push('p.has_images = false');
			if (contentType.text === false) conditions.push('p.has_text = false');
			//Word limits only apply if has_text = true
			if (Number.isFinite(wordLimits.min)) conditions.push(`(p.has_text = false OR p.word_count >= ${wordLimits.min})`);
			if (Number.isFinite(wordLimits.max)) conditions.push(`(p.has_text = false OR p.word_count <= ${wordLimits.max})`);
			//Date limits
			if (dateLimits.from) conditions.push(`p.created_at_remote >= '${new Date(dateLimits.from).toISOString()}'`);
			if (dateLimits.to) conditions.push(`p.created_at_remote <= '${new Date(dateLimits.to).toISOString()}'`);
			if (conditions.length > 0) {
				externalFiltersSQL = 'AND ' + conditions.join(' AND ');
			}
		}

        if (locationId === "search" && keyword) {
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    ...algorithmFilters, 
                    is_private: false,
                    [Op.and]: Sequelize.literal(`MATCH (title, text_body) AGAINST (${Posts.sequelize.escape(keyword)} IN NATURAL LANGUAGE MODE)`) 
                },
                order: orderMode,
                limit: backendFetchTotal,
                offset,
                raw: true
            });
            if (!postIds.length) return { posts: [], status: "ok", message: "" };
            const orderedIds = postIds.map(p => p.post_id);
            posts = await Posts.findAll({
                where: { post_id: orderedIds },
                include: includeOptions,
                attributes: attrOption,
                raw: false
            });
            const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
            posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
		} else if (locationId === "following") {
			const enabledSources = [];
			if (connectedAccounts.find(a => a.platform === 'reddit')) enabledSources.push('reddit');
			if (connectedAccounts.find(a => a.platform === 'bluesky')) enabledSources.push('bluesky');
			if (connectedAccounts.find(a => a.platform === 'mastodon')) enabledSources.push('mastodon');
			const hasExternalSources = connectedAccounts.length > 0;
			const halfLimit = Math.ceil(backendFetchTotal / 2);
			const halfOffset = Math.floor(offset / 2);
			//Fetch local posts (first batch)
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
			//Fetch external posts
			let externalAccesses = [];
			if (hasExternalSources) {
				externalAccesses = await sequelize.query(
					`
					SELECT
						p.post_id
					FROM external_posts_access a
					JOIN external_posts p ON p.post_id = a.post_id
					WHERE
						a.user_id = :userId
						AND p.expired = false
						AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
						${externalFiltersSQL}
					ORDER BY
						${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
					LIMIT :limit OFFSET :offset
					`,
					{
						replacements: { limit: halfLimit, offset: halfOffset, userId },
						type: QueryTypes.SELECT
					}
				);
				if (!externalAccesses.length && offset === 0) {
					await Promise.all(
						connectedAccounts.map(account =>
							processAccount({
								platform: account.platform,
								user_id: userId,
								access_token: account.access_token,
								instance_url: account.instance_url
							}).catch(() => null)
						)
					);
					externalAccesses = await sequelize.query(
						`
						SELECT
							p.post_id
						FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE
							a.user_id = :userId
							AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
							${externalFiltersSQL}
						ORDER BY
							${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
						LIMIT :limit OFFSET :offset
						`,
						{
							replacements: { limit: halfLimit, offset: halfOffset, userId },
							type: QueryTypes.SELECT
						}
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
			const formattedExternal = externalPosts.map(p => {
				const platformConfig = FEED_CONFIG[p.source];
				return formatExternalPost(p, platformConfig, p.source);
			});
			//Check if need to backfill
			const localCount = localPosts.length;
			const externalCount = formattedExternal.length;
			const totalSoFar = localCount + externalCount;
			const shortage = backendFetchTotal - totalSoFar;
			//Backfill from whichever source has more
			if (shortage > 0 && hasExternalSources) {
				if (localCount < halfLimit && externalCount >= halfLimit) {
					//Local ran short, fetch more external
					const moreExternal = await sequelize.query(
						`
						SELECT
							p.post_id
						FROM external_posts_access a
						JOIN external_posts p ON p.post_id = a.post_id
						WHERE
							a.user_id = :userId
							AND p.expired = false
							AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
							${externalFiltersSQL}
						ORDER BY
							${lowVoteImpact ? 'p.created_at_remote' : '(p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW())))'} DESC
						LIMIT :limit OFFSET :offset
						`,
						{
							replacements: { 
								limit: shortage, 
								offset: halfOffset + halfLimit, //Continue from where left off
								userId 
							},
							type: QueryTypes.SELECT
						}
					);
					if (moreExternal.length) {
						const moreIds = moreExternal.map(a => a.post_id);
						const morePosts = await ExternalPosts.findAll({
							where: { post_id: moreIds, content: { [Op.ne]: null } },
							raw: true
						});
						const moreFormatted = morePosts.map(p => {
							const platformConfig = FEED_CONFIG[p.source];
							return formatExternalPost(p, platformConfig, p.source);
						});
						formattedExternal.push(...moreFormatted);
					}
				} else if (externalCount < halfLimit && localCount >= halfLimit) {
					//External ran short, fetch more local
					const morePostIds = await Posts.findAll({
						attributes: ['post_id'],
						where: {
							...algorithmFilters, 
							feed_id: { [Op.in]: followedFeedIdsSafe },
							parent_id: null,
							...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
						},
						order: orderMode,
						limit: shortage,
						offset: halfOffset + halfLimit, //Continue from where left off
						raw: true
					});
					if (morePostIds.length) {
						const moreIds = morePostIds.map(p => p.post_id);
						const morePosts = await Posts.findAll({
							where: { post_id: moreIds },
							include: includeOptions,
							attributes: attrOption,
							raw: false
						});
						const moreOrderMap = new Map(moreIds.map((id, i) => [id, i]));
						morePosts.sort((a, b) => moreOrderMap.get(a.post_id) - moreOrderMap.get(b.post_id));
						localPosts.push(...morePosts);
					}
				}
			}
			const localWithFlag = localPosts.map(p => ({ ...(p.dataValues || p), isExternal: false }));
			const externalWithFlag = formattedExternal.map(p => ({ ...p, isExternal: true }));
			posts = [...localWithFlag, ...externalWithFlag].slice(0, backendFetchTotal);
		} else if (typeof locationId === 'string' && ['reddit','bluesky','mastodon'].includes(locationId)) {
            const platform = locationId;
            let accesses = [];
            if (userId) {
                accesses = await sequelize.query(
                    `
                    SELECT
                        p.post_id
                    FROM external_posts_access a
                    JOIN external_posts p ON p.post_id = a.post_id
                    WHERE
                        a.user_id = :userId
                        AND a.source = :platform
                        AND p.expired = false
                        AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                        ${externalFiltersSQL}
                    ORDER BY
                        (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
                    LIMIT :limit OFFSET :offset
                    `,
                    {
                        replacements: { limit: backendFetchTotal, offset, platform, userId },
                        type: QueryTypes.SELECT
                    }
                );
            }
            if (!accesses.length && connectedAccounts && connectedAccounts.length) {
                const account = connectedAccounts.find(a => a.platform === platform);
                if (account) {
                    await processAccount({
                        platform,
                        user_id: userId,
                        access_token: account.access_token,
                        instance_url: account.instance_url
                    }).catch(() => null);
                    accesses = await sequelize.query(
                        `
                        SELECT
                            p.post_id
                        FROM external_posts_access a
                        JOIN external_posts p ON p.post_id = a.post_id
                        WHERE
                            a.user_id = :userId
                            AND a.source = :platform
                            AND p.expired = false
                            AND p.created_at_remote >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                            ${externalFiltersSQL}
                        ORDER BY
                            (p.score * EXP(-0.00002 * TIMESTAMPDIFF(SECOND, p.created_at_remote, NOW()))) DESC
                        LIMIT :limit OFFSET :offset
                        `,
                        {
                            replacements: { limit: backendFetchTotal, offset, platform, userId },
                            type: QueryTypes.SELECT
                        }
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
            const formattedExternal = externalPosts.map(p => {
                const platformConfig = FEED_CONFIG[platform];
                return formatExternalPost(p, platformConfig, p.source);
            });
            posts = formattedExternal;
        } else if (locationId === "explore") {
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    ...algorithmFilters, 
                    //feed_id: { [Op.notIn]: followedFeedIdsSafe }, exclude followed feeds from explore
                    parent_id: null,
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {}),
                    is_private: false
                },
                order: orderMode,
                limit: backendFetchTotal,
                offset,
                raw: true
            });
			//console.log("explore postIds:", postIds.length);
            const orderedIds = postIds.map(p => p.post_id);
            posts = await Posts.findAll({
                where: { post_id: orderedIds },
                include: includeOptions,
                attributes: attrOption,
                raw: false
            });
            const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
            posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
            const deepFeedId = locationId.replace(/^deep_/, '');
            const contents = await DeepFeedContent.findAll({
                where: { deep_feed_id: deepFeedId },
                attributes: ['feed_id'],
                raw: true
            });
            const allFeedIds = contents.map(c => c.feed_id);
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    ...algorithmFilters, 
                    feed_id: { [Op.in]: allFeedIds },
                    parent_id: null,
                    ...(viewerId ? { poster_id: { [Op.not]: viewerId } } : {})
                },
                order: orderMode,
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
        } else {
            //Non-group channels are chronological by default
            const channelOrderMode = ((useChronological)
                        ? [['created_at', 'DESC']]
                        : [['rank_hotness', 'DESC']]);
            const postIds = await Posts.findAll({
                attributes: ['post_id'],
                where: {
                    ...algorithmFilters,
                    ...(!isMain && locationId ? { channel_id: locationId } : {}), //Get specific channel if not main feed
					...(isMain && feedId && !isGroup ? { poster_id: feedId } : {}), //Get all posts made by the user being viewed
					...(isMain && isGroup ? { feed_id: feedId } : {}), //Group feed main posts
                    parent_id: null,
                },
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
		//console.log("fetched posts:", posts.length);
        if (!posts.length) {
			if (algorithmLocation && isActiveToday && (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL)) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}

		//No algorithm to be applied
		if (useChronological || useStandardScore) {
			//Intermix for "following" feed before returning
			if (locationId === "following" && posts.some(p => p.isExternal === true) && posts.some(p => p.isExternal === false)) {
				const nativePosts = posts.filter(p => p.isExternal === false);
				const externalPosts = posts.filter(p => p.isExternal === true);
				posts = IntermixArrays(nativePosts, externalPosts);
			}
			const ids = posts.map(p => p.post_id);
			const [userVotes, savedRows] = viewerId
				? await Promise.all([
					PostVotes.findAll({
						attributes: ['post_id', 'upvotes', 'downvotes'],
						where: { post_id: { [Op.in]: ids }, voter_id: viewerId },
						raw: true
					}),
					SavedPosts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: ids }, saver_id: viewerId },
						raw: true
					})
				])
				: [[], []];
			const voteMap = new Map(
				userVotes.map(v => [v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }])
			);
			const savedSet = new Set(savedRows.map(s => s.post_id));
			return {
				posts: stripExcludedAttributes(
					posts.map(p => ({
						...(p.dataValues || p),
						...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
						is_saved: savedSet.has(p.post_id)
					}))
				),
				status: "ok"
			};
		}

        //Filter out posts, then apply scoring
		let finalPosts = [];
		//console.log("scoring:", scoring);
		//console.log("posts:", posts);
		//console.log("algorithm:", algorithm);

		//console.log("apply algorithm posts before ranking:", posts.length);
		//Predefined variables for use in scoring
		const now = Date.now();
		const tenDays = 864000000;
		let postEmbedding = [];
		try {
			const logStart = Date.now();
			for (const post of posts) {
				//Parse and normalise post embeddings once
				postEmbedding = post.embeddings;
				if (typeof postEmbedding === 'string') {
					try {
						postEmbedding = JSON.parse(postEmbedding);
					} catch {
						postEmbedding = [];
					}
				}
				if (!Array.isArray(postEmbedding)) postEmbedding = [];
				const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
				const normPost = postEmbedding.map(v => v / magPost);
				//Time of day filtering (can't be done efficiently in SQL)
				if (timeLimits.startTime && timeLimits.endTime) {
					const createdAt = new Date(post.created_at || post.created_at_remote);
					const postTime = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
					if (postTime < timeLimits.startTime || postTime > timeLimits.endTime) continue;
				}

				let algorithmScore = 0;
				//Unified baseHotness for native (rank_hotness) and external (score) posts
				const baseHotness = typeof post.rank_hotness === 'number'
					? post.rank_hotness
					: typeof post.score === 'number'
						? post.score
						: 0;
				algorithmScore = voteImpact > 0 ? baseHotness * voteImpact : 0;
				//algorithmScore += (chronology ?? 1) * baseHotness;

				//Vote quality * engagement ratio (distinct from hotness)
				if (voteImpact > 0) {
					const upvotes = post.upvotes || 0;
					const downvotes = post.downvotes || 0;
					const totalVotes = upvotes + downvotes;
					if (totalVotes > 0) {
						const netRatio = (upvotes - downvotes) / totalVotes;
						const engagementRatio = (post.views || 0) > 0 ? totalVotes / post.views : 0;
						algorithmScore += voteImpact * ((netRatio * 30) + (engagementRatio * 0.3)); //Heavily penalise negative ratios
					}
				}

				//Semantic boost/suppress using embeddings (algorithmRow holds precomputed embedding vectors)
				if (algorithmRow?.boost_embedding || algorithmRow?.suppress_embedding) {
					let semanticBoost = 0;
					let semanticSuppress = 0;
					if (algorithmRow.boost_embedding) {
						let boostVecs = algorithmRow.boost_embedding;
						if (typeof boostVecs === 'string') {
							try {
								boostVecs = JSON.parse(boostVecs);
							} catch {
								boostVecs = [];
							}
						}
						if (Array.isArray(boostVecs) && boostVecs.length) {
							//Normalise each boost vector before measuring similarity
							const normBoosts = boostVecs
								.map(bv => (Array.isArray(bv) ? bv : null))
								.filter(Boolean)
								.map(bv => {
									const m = Math.sqrt(bv.reduce((a, b) => a + b * b, 0)) || 1;
									return bv.map(v => v / m);
								});
							const sims = normBoosts.map(bv => {
								if (!bv || bv.length !== normPost.length) return 0;
								return CosineSimilarity(normPost, bv);
							});
							const top = sims.sort((a, b) => b - a).slice(0, 5);
							semanticBoost = top.reduce((a, b) => a + b, 0);
						}
					}
					if (algorithmRow.suppress_embedding) {
						let suppressVecs = algorithmRow.suppress_embedding;
						if (typeof suppressVecs === 'string') {
							try {
								suppressVecs = JSON.parse(suppressVecs);
							} catch {
								suppressVecs = [];
							}
						}
						if (Array.isArray(suppressVecs) && suppressVecs.length) {
							const normSuppress = suppressVecs
								.map(sv => (Array.isArray(sv) ? sv : null))
								.filter(Boolean)
								.map(sv => {
									const m = Math.sqrt(sv.reduce((a, b) => a + b * b, 0)) || 1;
									return sv.map(v => v / m);
								});
							const sims = normSuppress.map(sv => {
								if (!sv || sv.length !== normPost.length) return 0;
								return CosineSimilarity(normPost, sv);
							});
							const top = sims.sort((a, b) => b - a).slice(0, 5);
							semanticSuppress = top.reduce((a, b) => a + b, 0);
						}
					}
					algorithmScore += (semanticBoost * 20) - (semanticSuppress * 20);
				}

				//Sentiment alignment (safe default when missing)
				// change: guard against null/undefined sentiment_score
				const postSentiment = typeof post.sentiment_score === 'number' ? post.sentiment_score : 0;
				const sentimentDistance = Math.abs(postSentiment - sentiment);
				algorithmScore += (0.5 - sentimentDistance) * 10;

				//Variety scoring (cosine similarity against recent upvoted embeddings)
				let similarityScore = 0;
				if (normalisedRecentEmbeddings.length > 0) {
					const weights = recentUpvotePosts.map(p => {
						const age = now - new Date(p.updated_at).getTime();
						return 1 / (1 + age / tenDays);
					});
					const totalWeight = weights.reduce((a, b) => a + b, 0) || 1; //Higher weights for more recent upvotes
					let weightedSum = 0;
					for (let i = 0; i < normalisedRecentEmbeddings.length; i++) {
						const vectorEmbedding = normalisedRecentEmbeddings[i];
						//Compare normalised vectors only and use normPost
						if (vectorEmbedding.length === normPost.length) {
							const weight = weights[i] / totalWeight;
							const similarity = CosineSimilarity(normPost, vectorEmbedding);
							weightedSum += similarity * weight;
						}
					}
					similarityScore = Math.max(0, Math.min(1, weightedSum)); //Clamp between 0 and 1
				}
				const targetSimilarity = 0.6 * (1 - variety) + 0.1 * variety;
				const similarityDelta = targetSimilarity - similarityScore;
				const scoreAdjustment = similarityDelta * 30; //scaling factor
				algorithmScore += scoreAdjustment;
				finalPosts.push({ ...post.dataValues || post, algorithmScore });
			}
			//console.log("finalPosts:", finalPosts);
			//console.log("finalPosts length:", finalPosts.length);
			const logEnd = Date.now();
			//console.log("post processing time ms:", logEnd - logStart);
		} catch (error) {
			console.error(new Date().toISOString(), "error applying algorithm to posts:", error);
			finalPosts = posts; //Return initial post batch if issue applying algorithm
		}
		if (!finalPosts.length) {
			//console.log("ApplyAlgorithm: all posts excluded by algorithm filters");
			return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
		};
        finalPosts.sort((a, b) => b.algorithmScore - a.algorithmScore); //Sort posts by score
		//Intermix external and native posts for "following" feed if both types are present
		if (locationId === "following" && finalPosts.some(p => p.isExternal === true) && finalPosts.some(p => p.isExternal === false)) {
			const scoredNative = finalPosts.filter(p => p.isExternal === false);
			const scoredExternal = finalPosts.filter(p => p.isExternal === true);
			finalPosts = IntermixArrays(scoredNative, scoredExternal);
		}
        const paginatedFinalPosts = finalPosts.slice(0, limit); //Return top 100 posts
        const finalIds = paginatedFinalPosts.map(p => p.post_id);
		const [userVotes, savedRows] = viewerId
			? await Promise.all([
				PostVotes.findAll({
					attributes: ['post_id', 'upvotes', 'downvotes'],
                    where: { post_id: { [Op.in]: finalIds }, voter_id: viewerId },
					raw: true
				}),
				SavedPosts.findAll({
					attributes: ['post_id'],
                    where: { post_id: { [Op.in]: finalIds }, saver_id: viewerId },
					raw: true
				})
			])
			: [[], []];
		const voteMap = new Map(userVotes.map(v => [
			v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }
		]));
		const savedSet = new Set(savedRows.map(s => s.post_id));
		const postsWithVotes = paginatedFinalPosts.map(p => ({
			...(p.dataValues || p),
			...(voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false }),
			is_saved: savedSet.has(p.post_id)
		}));
		//console.log("ApplyAlgorithm returning posts:", postsWithVotes.length);
		return { posts: stripExcludedAttributes(postsWithVotes), status: "ok", message: "" }; //Frontend does not need message for success
	} catch (error) {
		console.error(new Date().toISOString(), 'Error in ApplyAlgorithm:', error);
		return { posts: [], status: "error", message: "" };
	}
}

export { ApplyAlgorithm };