import { ExternalPosts } from "../../models/content.js";
import { Op } from "sequelize";

//Batch-fetch and attach quoted external posts to raw external post objects
export async function attachQuotedExternalPosts(posts) {
    const quotedIds = posts
        .map(p => p.quoted_external_post_id)
        .filter(Boolean);
    if (quotedIds.length === 0) return posts;
    const uniqueIds = [...new Set(quotedIds)];
    const quotedPosts = await ExternalPosts.findAll({
        where: { post_id: { [Op.in]: uniqueIds } },
        raw: true
    });
    const quotedMap = new Map(quotedPosts.map(qp => [qp.post_id, qp]));
    return posts.map(p => {
        if (p.quoted_external_post_id && quotedMap.has(p.quoted_external_post_id)) {
            return { ...p, quotedExternalPost: quotedMap.get(p.quoted_external_post_id) };
        }
        return p;
    });
}

//Format for return to frontend
export function formatExternalPost(p, config, platform) {
    const authorName = p.author || `${platform}_user`;
    const profileUrl = p.source === 'reddit'
        ? `https://www.reddit.com/user/${(p.author || '').replace('u/','')}`
        : p.source === 'bluesky'
        ? `https://bsky.app/profile/${p.author}`
        : config.getProfileUrl(p);
    const scoreValue = p.score ?? 0;
    const sourceLabel = p.source === 'reddit' ? 'Reddit' : p.source === 'bluesky' ? 'Bluesky' : config.sourceName;
    //Format quoted external post if present (from Sequelize include or manual attachment)
    const rawQEP = p.quotedExternalPost?.dataValues || p.quotedExternalPost;
    let formattedQEP = undefined;
    if (rawQEP && rawQEP.post_id) {
        formattedQEP = formatExternalPost(rawQEP, config, rawQEP.source?.toLowerCase() || platform);
    }
    return {
        ...p,
        post_id: p.post_id, // Explicitly preserve post_id
        parent_id: p.parent_id, // Explicitly preserve parent_id for replies
        channel: p.channel || config.getChannel(p),
        content: p.content,
        created_at: p.created_at_remote,
        downvotes: 0,
        has_downvoted: false,
        has_embedded_websites: false,
        has_external_posts: false,
        has_interactive: false,
        has_upvoted: false,
        is_external: true,
        is_saved: false,
        poster: {
            profile_url: profileUrl,
            user_photo: p.author_photo || config.defaultIcon,
            username: authorName
        },
        replies: p.replies || 0,
        score: scoreValue,
        source: sourceLabel,
        text_body: p.text_body,
        title: p.title,
        upvotes: scoreValue,
        url: p.url,
        views: 0,
        ...(formattedQEP ? { quotedExternalPost: formattedQEP } : {})
    };
}