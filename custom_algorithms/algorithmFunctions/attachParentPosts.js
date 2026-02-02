export async function attachParentPosts(posts, includeOptions) {
	if (!posts || posts.length === 0) return posts;
	//Find posts that are replies (have a parent_id)
	const postsWithParents = posts.filter(p => p.parent_id);
	if (postsWithParents.length === 0) return posts;
	//Get unique parent IDs
	const parentIds = [...new Set(postsWithParents.map(p => p.parent_id))];
	//Fetch parent posts
	const parentPosts = await Posts.findAll({
		where: { post_id: { [Op.in]: parentIds } },
		include: includeOptions,
		raw: false
	});
	//Create a map of parent posts by post_id
	const parentMap = new Map();
	parentPosts.forEach(parent => {
		const parentData = parent.dataValues || parent;
		parentMap.set(parentData.post_id, parentData);
	});
	//Attach parent post data to each reply
	return posts.map(post => {
		if (post.parent_id && parentMap.has(post.parent_id)) {
			return {
				...(post.dataValues || post),
				parentPost: parentMap.get(post.parent_id)
			};
		}
		return post;
	});
}