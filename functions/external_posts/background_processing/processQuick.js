import { computeHotness } from "../../postRanking.js"
import { ExternalPosts } from "../../../models/content.js";
import { mapBlueskyToExternal } from "../map_to_external/mapBlueskyToExternal.js";
import { mapMastodonToExternal } from "../map_to_external/mapMastodonToExternal.js";
import { mapRedditToExternal } from "../map_to_external/mapRedditToExternal.js";
import { processBackground } from "./processBackground.js";

//Quick processing - stores posts with basic HTML, returns immediately
//Heavy processing (embeddings, sentiment) happens in background
export async function processQuick(platform, accountId, posts, htmlGenerator, instanceUrl = null) {
    try {
        const mappedPosts = posts.map(item => {
            let p;
            if (platform === 'bluesky') {
                p = mapBlueskyToExternal(item);
            } else if (platform === 'mastodon') {
                p = mapMastodonToExternal(item, instanceUrl);
            } else {
                return null;
            }
            const rank_hotness = computeHotness({
                upvotes: p.score,
                downvotes: 0,
                createdAt: p.created_at_remote,
                referenceTime: Math.floor(Date.now() / 1000)
            });
            return { ...p, rank_hotness };
        }).filter(Boolean);
        //Dedupe
        const localSeen = new Set();
        const uniquePosts = mappedPosts.filter(p => {
            if (localSeen.has(p.post_id)) return false;
            localSeen.add(p.post_id);
            return true;
        });
        //Check which posts already exist
        const postIds = uniquePosts.map(p => p.post_id);
        const existingPosts = await ExternalPosts.findAll({
            where: { post_id: postIds },
            attributes: ['post_id'],
            raw: true
        });
        const existingIds = new Set(existingPosts.map(r => r.post_id));
        const postsToInsert = uniquePosts.filter(p => !existingIds.has(p.post_id));
        //Quick insert - just basic HTML, no heavy processing
        if (postsToInsert.length > 0) {
            const quickInserts = await Promise.all(postsToInsert.map(async mapped => {
                //For Mastodon, use content (HTML) instead of text_body; for Bluesky use text_body
                const contentToPass = platform === 'mastodon' ? mapped.content : mapped.text_body;
                const html = await htmlGenerator(contentToPass, mapped.media);
                const has_text = (mapped.text_body?.length || 0) > 0;
                return {
                    post_id: mapped.post_id,
                    source: mapped.source,
                    source_post_id: mapped.source_post_id,
                    title: mapped.title || null,
                    content: html,
                    text_body: mapped.text_body || null,
                    text_length: mapped.text_length || 0,
                    word_count: mapped.word_count || 0,
                    image_count: mapped.image_count || 0,
                    video_count: mapped.video_count || 0,
                    has_text,
                    has_images: mapped.has_images || false,
                    has_videos: mapped.has_videos || false,
                    score: mapped.score || 0,
                    replies: mapped.replies || 0,
                    sentiment_score: 0, //Will be updated in background
                    embeddings: null, //Will be updated in background
                    fetched_at: mapped.fetched_at,
                    created_at_remote: mapped.created_at_remote,
                    expired: mapped.expired || false,
                    channel: mapped.channel || null,
                    author: mapped.author || null,
                    author_did: mapped.author_did || null,
                    author_photo: mapped.author_photo || null,
                    url: mapped.url,
                    media: mapped.media,
                    cid: mapped.cid || null
                };
            }));
            const updateFields = [
                'source_post_id', 'title', 'content', 'text_body', 'text_length', 'word_count',
                'image_count', 'video_count', 'has_text', 'has_images', 'has_videos',
                'score', 'replies', 'fetched_at', 'expired',
                'channel', 'author', 'author_did', 'author_photo', 'url', 'media', 'cid'
            ];
            await ExternalPosts.bulkCreate(quickInserts, {
                updateOnDuplicate: updateFields,
                logging: false
            });
            //Run heavy processing in background (don't await)
            processBackground(postsToInsert.map(p => p.post_id)).catch(err => {
                console.error(new Date().toISOString(), 'Background processing error:', err);
            });
        }
        return uniquePosts.length;
    } catch (error) {
        console.error(new Date().toISOString(), 'processQuick error:', error);
        throw error;
    }
}