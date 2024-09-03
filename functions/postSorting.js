import { Users } from "../models/models.js";

async function sortPostsByWeightedRatio(posts, userId) {
    //try {
        const now = new Date();

        //Gets users recency preference
        const user = await Users.findByPk(userId, {
            attributes: ['time_preference'],
        });

        const time_preference = user.dataValues.time_preference;
        const time_weight_constant = Math.max(time_preference, 0.0001); //In case constant is 0

        //Calculates ratio of upvotes to downvotes and views per upvotes, weighted by time
        const sortedPosts = posts.map((post) => {
        const { upvotes = 0, downvotes = 0, views = 0, timestamp = 0 } = post;
        const postDate = new Date(timestamp);
        const ageInMinutes = (now - postDate) / (1000 * 60); //Converts milliseconds to minutes

        //Avoid division by zero
        const downvotes_safe = Math.max(downvotes, 1);
        const upvotes_safe = Math.max(upvotes, 1);
        //Avoids null score
        const views_safe = Math.max(views, 1);

        const score = ((upvotes_safe / downvotes_safe) / (views_safe / upvotes_safe)) * views_safe;
        const time_weight = 1 / (1 + time_weight_constant * ageInMinutes);
        const weighted_score = score * time_weight;

        return { ...post, score: weighted_score }; 
        }).sort((a, b) => b.score - a.score); 
        
        //Checks scores
        //sortedPosts.forEach((post) => {
            //console.log(post.title, post.score);
        //});
        
        return sortedPosts; 
    //} catch (error) {
        //console.log("Sorting error:", error);
    //}
}

export default sortPostsByWeightedRatio;