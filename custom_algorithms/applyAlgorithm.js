import { Algorithms, AlgorithmLocations } from "./algorithms.js";
import { attachParentPosts } from "./algorithmFunctions/attachParentPosts.js";
import { Posts, PostVotes, Reposts, SavedPosts, SavedExternalPosts } from "../models/relationships.js";
import { excludedAttrs } from "./algorithmFunctions/stripExcludedAttributes.js";
import { ExternalPostVotes } from "../models/content.js";
import { fetchDefaultPosts } from "./fetchHandlers/fetchDefaultPosts.js";
import { fetchDeepFeedPosts } from "./fetchHandlers/fetchDeepFeedPosts.js";
import { fetchExplorePosts } from "./fetchHandlers/fetchExplorePosts.js";
import { fetchExternalAccountPosts } from "./fetchHandlers/fetchExternalAccountPosts.js";
import { fetchFollowingPosts } from "./fetchHandlers/fetchFollowingPosts.js";
import { fetchPlatformPosts } from "./fetchHandlers/fetchPlatformPosts.js";
import { fetchSearchPosts } from "./fetchHandlers/fetchSearchPosts.js";
import { FEED_CONFIG } from "../routes/socialConnect.js";
import { formatExternalPost } from "../functions/external_posts/formatExternalPost.js";
import { IntermixArrays } from "../functions/intermixArrays.js";
import { Op } from 'sequelize';
import { stripExcludedAttributes } from "./algorithmFunctions/stripExcludedAttributes.js";

async function attachParentAndQuotedData(posts, includeOptions, viewerId, voteMap, externalVoteMap, savedSet, repostSet) {
	const postsWithParents = await attachParentPosts(posts, includeOptions);
	const parentPostIds = postsWithParents.filter(p => p.parentPost).map(p => p.parentPost.post_id);
	const quotedPostIds = postsWithParents.filter(p => p.quotedPost).map(p => (p.quotedPost.dataValues || p.quotedPost).post_id).filter(Boolean);
	const relatedNativeIds = [...new Set([...parentPostIds, ...quotedPostIds])];
	let relatedVotes = [], relatedSaved = [], relatedReposts = [];
	if (viewerId && relatedNativeIds.length > 0) {
		[relatedVotes, relatedSaved, relatedReposts] = await Promise.all([
			PostVotes.findAll({
				attributes: ['post_id', 'upvotes', 'downvotes'],
				where: { post_id: { [Op.in]: relatedNativeIds }, voter_id: viewerId },
				raw: true
			}),
			SavedPosts.findAll({
				attributes: ['post_id'],
				where: { post_id: { [Op.in]: relatedNativeIds }, saver_id: viewerId },
				raw: true
			}),
			Reposts.findAll({
				attributes: ['post_id'],
				where: { post_id: { [Op.in]: relatedNativeIds }, reposter_id: viewerId },
				raw: true
			})
		]);
	}
	const relatedVoteMap = new Map(relatedVotes.map(v => [v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }]));
	const relatedSavedSet = new Set(relatedSaved.map(s => s.post_id));
	const relatedRepostSet = new Set(relatedReposts.map(r => r.post_id));
	return postsWithParents.map(p => {
		const isExternal = p.isExternal || p.is_external;
		const votes = isExternal
			? (externalVoteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false })
			: (voteMap.get(p.post_id) || { has_upvoted: false, has_downvoted: false });
		const parentPost = p.parentPost ? {
			...p.parentPost,
			...(relatedVoteMap.get(p.parentPost.post_id) || { has_upvoted: false, has_downvoted: false }),
			is_saved: relatedSavedSet.has(p.parentPost.post_id),
			has_reposted: relatedRepostSet.has(p.parentPost.post_id)
		} : undefined;
		const rawQuoted = p.quotedPost?.dataValues || p.quotedPost;
		const quotedPost = rawQuoted ? {
			...rawQuoted,
			...(relatedVoteMap.get(rawQuoted.post_id) || { has_upvoted: false, has_downvoted: false }),
			is_saved: relatedSavedSet.has(rawQuoted.post_id),
			has_reposted: relatedRepostSet.has(rawQuoted.post_id)
		} : undefined;
		const rawQEP = p.quotedExternalPost?.dataValues || p.quotedExternalPost;
		const quotedExternalPost = rawQEP ? formatExternalPost(rawQEP, FEED_CONFIG[rawQEP.source], rawQEP.source) : undefined;
		return {
			...(p.dataValues || p),
			...votes,
			is_saved: savedSet.has(p.post_id),
			has_reposted: repostSet.has(p.post_id),
			...(parentPost ? { parentPost } : {}),
			...(quotedPost ? { quotedPost } : {}),
			...(quotedExternalPost ? { quotedExternalPost } : {})
		};
	});
}

async function ApplyAlgorithm({ locationId, feedId, followedFeedIds, includeOptions, isGroup = true, isMain, limit = 100, offset, recentUpvotes, viewerId, keyword = '', connectedAccounts = [], userId, excludePostIds = [] }) {
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
					attributes: ['algorithm_code', 'boost_embedding', 'suppress_embedding', 'political_opinion_embedding'],
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

		const { chronology = 0, contentType = {}, variety = 1, wordLimits = {}, videoLimits = {}, timeLimits = {}, scoring = {}, controversyScore = 0, accountSizePreference = 0.5, sourceDiversity = 0.5, authorDiversity = 0.5, interactionWeights = {}, learningRate = 0.5, politicalPosition = 0.5, politicalDisagreement = 0 } = algorithm;
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

		const scoringParams = { voteImpact, sentiment, variety, normalisedRecentEmbeddings, recentUpvotePosts, timeLimits, controversyScore, accountSizePreference, sourceDiversity, authorDiversity, interactionWeights, learningRate, politicalDisagreement };

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
			posts = await fetchSearchPosts({ keyword, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams });
			if (posts.status) return posts;
		} else if (locationId === "following") {
			posts = await fetchFollowingPosts({ followedFeedIdsSafe, viewerId, userId, connectedAccounts, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, lowVoteImpact, algorithmRow, scoringParams });
			if (posts.status) return posts;
		} else if (typeof locationId === 'string' && locationId.startsWith('external_account_')) {
			posts = await fetchExternalAccountPosts({ locationId, userId, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams });
			if (posts.status) return posts;
		} else if (typeof locationId === 'string' && ['reddit','bluesky','mastodon'].includes(locationId)) {
			posts = await fetchPlatformPosts({ locationId, userId, connectedAccounts, hasActiveAlgorithm, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams });
			if (posts.status) return posts;
        } else if (locationId === "explore") {
			posts = await fetchExplorePosts({ viewerId, hasActiveAlgorithm, algorithmFilters, externalFiltersSQL, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, lowVoteImpact, algorithmRow, scoringParams });
			if (posts.status) return posts;
        } else if (typeof locationId === 'string' && locationId.startsWith('deep_')) {
			posts = await fetchDeepFeedPosts({ locationId, viewerId, hasActiveAlgorithm, algorithmFilters, MAX_ALGORITHM_CANDIDATES, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, algorithmRow, scoringParams });
			if (posts.status) return posts;
        } else {
			posts = await fetchDefaultPosts({ locationId, feedId, isGroup, isMain, viewerId, hasActiveAlgorithm, algorithmFilters, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, useChronological, MAX_ALGORITHM_CANDIDATES, algorithmRow, scoringParams });
			if (posts.status) return posts;
        }

        if (!posts.length) {
			if (hasActiveAlgorithm && (Object.keys(algorithmFilters).length > 0 || externalFiltersSQL)) {
				return { posts: [], status: "filtered", message: "Your algorithm settings filtered out all posts." };
			}
			return { posts: [], status: "ok", message: "" };
		}

		//Deduplicate posts by post_id
		const seenIds = new Set();
		posts = posts.filter(p => {
			if (seenIds.has(p.post_id)) return false;
			seenIds.add(p.post_id);
			return true;
		});

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
			const [userVotes, externalVotes, savedNativeRows, savedExternalRows, repostRows] = viewerId
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
					nativeIds.length ? SavedPosts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: nativeIds }, saver_id: viewerId },
						raw: true
					}) : Promise.resolve([]),
					externalIds.length ? SavedExternalPosts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: externalIds }, saver_id: viewerId },
						raw: true
					}) : Promise.resolve([]),
					Reposts.findAll({
						attributes: ['post_id'],
						where: { post_id: { [Op.in]: ids }, reposter_id: viewerId },
						raw: true
					})
				])
				: [[], [], [], [], []];
			const voteMap = new Map(
				userVotes.map(v => [v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }])
			);
			const externalVoteMap = new Map(externalVotes.map(v => [v.post_id, {
				has_upvoted: v.vote_type === 'upvote' || v.vote_type === 'like',
				has_downvoted: v.vote_type === 'downvote'
			}]));
			const savedSet = new Set([...savedNativeRows.map(s => s.post_id), ...savedExternalRows.map(s => s.post_id)]);
			const repostSet = new Set(repostRows.map(r => r.post_id));
			const postsWithVotes = await attachParentAndQuotedData(posts, includeOptions, viewerId, voteMap, externalVoteMap, savedSet, repostSet);
			return { posts: stripExcludedAttributes(postsWithVotes), status: "ok" };
		}
		const finalIds = posts.map(p => p.post_id);
		//Separate native and external post IDs for vote lookup
		const nativeIds = posts.filter(p => !p.isExternal).map(p => p.post_id);
		const externalIds = posts.filter(p => p.isExternal).map(p => p.post_id);
		const [userVotes, externalVotes, savedNativeRows, savedExternalRows, repostRows] = viewerId
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
				nativeIds.length ? SavedPosts.findAll({
					attributes: ['post_id'],
					where: { post_id: { [Op.in]: nativeIds }, saver_id: viewerId },
					raw: true
				}) : Promise.resolve([]),
				externalIds.length ? SavedExternalPosts.findAll({
					attributes: ['post_id'],
					where: { post_id: { [Op.in]: externalIds }, saver_id: viewerId },
					raw: true
				}) : Promise.resolve([]),
				Reposts.findAll({
					attributes: ['post_id'],
					where: { post_id: { [Op.in]: finalIds }, reposter_id: viewerId },
					raw: true
				})
			])
			: [[], [], [], [], []];
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
		const savedSet = new Set([...savedNativeRows.map(s => s.post_id), ...savedExternalRows.map(s => s.post_id)]);
		const repostSet = new Set(repostRows.map(r => r.post_id));
		const postsWithVotes = await attachParentAndQuotedData(posts, includeOptions, viewerId, voteMap, externalVoteMap, savedSet, repostSet);
		return { posts: stripExcludedAttributes(postsWithVotes), status: "ok", message: "" };
	} catch (error) {
		console.error(new Date().toISOString(), 'Error in ApplyAlgorithm:', error);
		return { posts: [], status: "error", message: "" };
	}
}

export { ApplyAlgorithm };