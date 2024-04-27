function sortPostsByWeightedRatio(posts, time_weight_constant = 0.0001) {
    try {
        const now = new Date();

        //Calculates ratio of upvotes to downvotes and views per upvotes, weighted by time
        const sortedPosts = posts.map((post) => {
        const { upvotes, downvotes, views, timestamp } = post;
        const postDate = new Date(timestamp);
        const ageInMinutes = (now - postDate) / (1000 * 60); //Converts milliseconds to minutes

        //Avoid division by zero
        const downvotes_safe = downvotes || 1;
        const upvotes_safe = upvotes || 1;

        const ratio = (upvotes_safe / downvotes_safe) / (views / upvotes_safe);

        const time_weight = 1 / (1 + time_weight_constant * ageInMinutes);

        const weighted_ratio = ratio * time_weight;

        return { ...post, ratio: weighted_ratio }; 
        }).sort((a, b) => b.ratio - a.ratio); 

    return sortedPosts; 
    } catch (error) {
        console.log("Sorting error:", error);
    }
}

export default sortPostsByWeightedRatio;