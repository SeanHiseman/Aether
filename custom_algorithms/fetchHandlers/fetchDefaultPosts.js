import { ExternalPosts } from "../../models/content.js";
import { fetchPaginatedPostData } from "../algorithmFunctions/fetchPaginatedPostData.js";
import { FEED_CONFIG } from "../../routes/socialConnect.js";
import { formatExternalPost } from "../../functions/external_posts/formatExternalPost.js";
import { Feeds, Posts, Reposts } from "../../models/relationships.js";
import { Op } from 'sequelize';
import { scoreAndPaginateCandidates } from "../algorithmFunctions/scoreAndPaginateCandidates.js";

export async function fetchDefaultPosts({ locationId, feedId, isGroup, isMain, viewerId, hasActiveAlgorithm, algorithmFilters, orderMode, backendFetchTotal, offset, limit, includeOptions, attrOption, useChronological, MAX_ALGORITHM_CANDIDATES, algorithmRow, scoringParams }) {
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
		//For user main feeds, include replies; for group main feeds and channels, only top-level posts
		...(isMain && !isGroup ? {} : { parent_id: null }),
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
		return await fetchPaginatedPostData({ paginatedIds, scoreMap, includeOptions, attrOption });
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
		let posts = await Posts.findAll({
			where: { post_id: orderedIds },
			include: includeOptions,
			attributes: attrOption,
			raw: false
		});
		const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
		posts.sort((a, b) => orderMap.get(a.post_id) - orderMap.get(b.post_id));
		//Fetch reposts for Main channel
		if (isMain && feedId) {
			try {
				const reposts = await Reposts.findAll({
					where: { reposter_id: feedId },
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
					const rawExternal = await ExternalPosts.findAll({
						where: { post_id: { [Op.in]: externalRepostIds }, content: { [Op.ne]: null } },
						raw: true
					});
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
				//Merge reposts with regular posts
				posts = [...posts, ...nativeRepostPosts, ...externalRepostPosts];
				//Sort by creation/repost time
				posts.sort((a, b) => {
					const aTime = a.reposted_at || a.created_at || a.created_at_remote;
					const bTime = b.reposted_at || b.created_at || b.created_at_remote;
					return new Date(bTime) - new Date(aTime);
				});
			} catch (error) {
				console.error('Error fetching reposts:', error);
				//Continue without reposts if there's an error
			}
		}
		return posts;
	}
}