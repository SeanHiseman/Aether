import { ContentAnalyser } from "../../contentAnalyser.js";
import { ExternalPosts } from "../../../models/content.js";
import { getEmbedder } from "../../contentAnalyser.js";

const contentAnalyser = new ContentAnalyser();

//Background processing - updates posts with embeddings and sentiment
export async function processBackground(postIds) {
    try {
        const posts = await ExternalPosts.findAll({
            where: { post_id: postIds, embeddings: null },
            raw: true
        });
        if (posts.length === 0) return;
        const embedder = await getEmbedder();
        for (const post of posts) {
            try {
                const details = await contentAnalyser.analyseContent(post.content, post.title, embedder);
                await ExternalPosts.update({
                    sentiment_score: details?.sentiment_score ?? 0,
                    embeddings: details?.embeddings ?? null
                }, {
                    where: { post_id: post.post_id }
                });
            } catch (error) {
                console.error(new Date().toISOString(), 'Error processing post:', post.post_id, error);
            }
        }
    } catch (error) {
        console.error(new Date().toISOString(), 'processBackground error:', error);
    }
}