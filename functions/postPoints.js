function calculatePoints(upvotes, downvotes, views) {
    //Avoid division by zero
    const downvotes_safe = Math.max(downvotes, 1);
    const upvotes_safe = Math.max(upvotes, 1);
    //Avoids null score
    const views_safe = Math.max(views, 1);
    const pointsWeight = 10000; //score divided by this number, shoul be adjusted
    const score = (((upvotes_safe / downvotes_safe) / (views_safe / upvotes_safe)) * views_safe) / pointsWeight;
    return Math.floor(score * views);
}

export default calculatePoints;