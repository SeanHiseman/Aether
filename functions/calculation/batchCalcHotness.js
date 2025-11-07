import { computeHotness } from "../postRanking.js";
import { Posts } from "../../models/relationships.js";

(async () => {
	try {
		console.log("Recalculating post hotness...");
		const now = Math.floor(Date.now() / 1000);
		const batchSize = 1000;
		let offset = 0;
		let totalUpdated = 0;
		while (true) {
			const posts = await Posts.findAll({
				attributes: ["post_id", "upvotes", "downvotes", "created_at"],
				limit: batchSize,
				offset,
				raw: true
			});
			if (posts.length === 0) break;
			const updates = posts.map(p => {
				const newHotness = computeHotness({
					upvotes: p.upvotes || 0,
					downvotes: p.downvotes || 0,
					createdAt: p.created_at,
					referenceTime: now
				});
				return { post_id: p.post_id, rank_hotness: newHotness };
			});
			for (const u of updates) {
				await Posts.update(
					{ rank_hotness: u.rank_hotness },
					{ where: { post_id: u.post_id } }
				);
			}
			totalUpdated += updates.length;
			offset += batchSize;
			console.log(`Updated ${totalUpdated} posts so far...`);
		}
		console.log(`Recalculation complete. ${totalUpdated} posts updated.`);
		process.exit(0);
	} catch (error) {
		console.error("Error recalculating hotness:", error);
		process.exit(1);
	}
})();