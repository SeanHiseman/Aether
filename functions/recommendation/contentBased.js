import { Posts, PostVotes } from "../../models/content.js";
import { Feeds } from "../../models/feeds.js";
import natural from 'natural';
const { TfIdf } = natural;

//HTML tags are present in raw content
const stripHtmlTags = (content) => {
    return content.replace(/<[^>]*>?/gm, '');
};

//Ensures text is in same format
const normalizeText = (text) => text.trim().toLowerCase();

const cosineSimilarity = (vector1, vector2) => {
    const terms = new Set([...vector1.keys(), ...vector2.keys()]);
    let dotProduct = 0;
    let vector1Magnitude = 0;
    let vector2Magnitude = 0;
    for (const term of terms) {
        const value1 = vector1.get(term) || 0;
        const value2 = vector2.get(term) || 0;
        dotProduct += value1 * value2;
        vector1Magnitude += value1 ** 2;
        vector2Magnitude += value2 ** 2;
    }
    vector1Magnitude = Math.sqrt(vector1Magnitude);
    vector2Magnitude = Math.sqrt(vector2Magnitude);
    if (vector1Magnitude === 0 || vector2Magnitude === 0) {
        return 0;
    }
    return dotProduct / (vector1Magnitude * vector2Magnitude);
};

//Includes title for analysis
const processPostText = (title, content) => {
    const cleanedContent = stripHtmlTags(content);
    return `${title} ${cleanedContent}`;
};

//Calculates TF-IDF vector for each post
const userInteractionVector = (upvotedPosts, tfidf) => {
    const interactionVector = new Map();
    upvotedPosts.forEach((upvotedPostText) => {
        const normalizedUpvotedPostText = normalizeText(upvotedPostText);
        const index = tfidf.documents.findIndex((doc) => {
            const docText = normalizeText(Object.keys(doc).filter(key => key !== '__key').join(' '));
            return docText === normalizedUpvotedPostText;
        });
        if (index < 0) return; //Skip if not found
        const terms = tfidf.listTerms(index);
        terms.forEach(({ term, tfidf: termTfidf }) => {
            interactionVector.set(term, (interactionVector.get(term) || 0) + termTfidf);
        });
    });
    return interactionVector;
};

const userInteractionRecommendations = async (user) => {
    const userUpvotedPosts = await PostVotes.findAll({
        where: { user_id: user.user_id },
        include: [
            { model: Posts, as: 'Post' },
        ],
    });
    const userUpvotedPostContents = userUpvotedPosts.flatMap((vote) => [
        ...(vote.Post ? [processPostText(vote.Post.title, vote.Post.content)] : []),
    ]);
    const posts = await Posts.findAll({
        include: [{
            model: Feeds,
            as: 'Poster',
            attributes: ['post_id', 'parent_id', 'feed_id', 'channel_id', 'title', 'content', 'replies', 'views', 'upvotes', 'downvotes', 'timestamp', 'poster_id', 'points'],
        }],
    });
    const tfidf = new TfIdf();
    posts.forEach((post) => {
        const postText = processPostText(post.title, post.content);
        tfidf.addDocument(postText);
    });
    //Creates interaction vector from upvoted posts
    const interactionVector = userInteractionVector(userUpvotedPostContents, tfidf);
    //Finds similarity scores
    const recommendations = posts
        .map((post, index) => {
            const postVector = new Map();
            tfidf.listTerms(index).forEach(({ term, tfidf }) => {
                postVector.set(term, tfidf);
            });
            const score = cosineSimilarity(interactionVector, postVector);
            return { ...post, score };
        })
        .sort((a, b) => b.score - a.score)
    return recommendations;
};

export { userInteractionRecommendations };