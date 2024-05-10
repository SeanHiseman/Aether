import { ContentVotes, GroupPosts, Profiles, ProfilePosts, Users } from "../../models/models.js";
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
    const userUpvotedPosts = await ContentVotes.findAll({
        where: { user_id: user.user_id },
        include: [
            { model: ProfilePosts, as: 'ProfilePost' },
            { model: GroupPosts, as: 'GroupPost' },
        ],
    });

    const userUpvotedPostContents = userUpvotedPosts.flatMap((vote) => [
        ...(vote.ProfilePost ? [processPostText(vote.ProfilePost.title, vote.ProfilePost.content)] : []),
        ...(vote.GroupPost ? [processPostText(vote.GroupPost.title, vote.GroupPost.content)] : []),
    ]);

    const profilePosts = await ProfilePosts.findAll({
        include: [{
            model: Users,
            as: 'ProfilePoster',
            attributes: ['username'],
            include: [{
                model: Profiles,
                attributes: ['profile_photo'],
            }]
        }],
    });
    
    const groupPosts = await GroupPosts.findAll({
        include: [{
            model: Users,
            as: 'GroupPoster',
            attributes: ['username'],
            include: [{
                model: Profiles,
                   attributes: ['profile_photo'],
            }]
        }],
    });

    const allPosts = [
        ...profilePosts.map(post => ({
            ...post.get({ plain: true }),
            is_group: false, 
            ProfilePoster: {
                username: post.ProfilePoster.username,
                profile: post.ProfilePoster.profile 
            },
        })),
        ...groupPosts.map(post => ({
            ...post.get({ plain: true }), 
            is_group: true, 
            GroupPoster: {
                username: post.GroupPoster.username,
                profile: post.GroupPoster.profile 
            },
        }))
    ];

    const tfidf = new TfIdf();
    allPosts.forEach((post) => {
        const postText = processPostText(post.title, post.content);
        tfidf.addDocument(postText);
    });

    //Creates interaction vector from upvoted posts
    const interactionVector = userInteractionVector(userUpvotedPostContents, tfidf);

    //Finds similarity scores
    const recommendations = allPosts
        .map((post, index) => {
            const postVector = new Map();
            tfidf.listTerms(index).forEach(({ term, tfidf }) => {
                postVector.set(term, tfidf);
            });
            const score = cosineSimilarity(interactionVector, postVector);
            return { ...post, score };
        })
        .sort((a, b) => b.score - a.score)
    //Checks scores
    //recommendations.forEach((post) => {
        //console.log("content based:", post.title, post.score);
    //});
    //console.log("recommendations:", recommendations);
    return recommendations;
};

export { userInteractionRecommendations };