import { fastCosineSimilarity } from "./fastCosineSimilarity.js";

//Computes algorithm score for a single post
export function computeAlgorithmScore(post, params) {
	const {
		algorithmRow, normalizedBoost, normalizedSuppress, normalizedPolitical, voteImpact, sentiment, variety,
		normalisedRecentEmbeddings, recentUpvotePosts, recentWeights, totalWeight,
		controversyScore = 0, accountSizePreference = 0.5, sourceDiversity = 0.5,
		authorDiversity = 0.5, interactionWeights = {}, learningRate = 0.5, politicalDisagreement = 0,
		authorCounts = {}, sourceCounts = {}, authorKey, sourceKey
	} = params;

	let postEmbedding = post.embeddings;
	if (typeof postEmbedding === 'string') {
		try { postEmbedding = JSON.parse(postEmbedding); } catch { postEmbedding = []; }
	}
	if (!Array.isArray(postEmbedding)) postEmbedding = [];

	if (postEmbedding.length === 0) {
		return { score: 0, reasons: ['No content analysis available'] };
	}

	const magPost = Math.sqrt(postEmbedding.reduce((a, b) => a + b * b, 0)) || 1;
	const normPost = postEmbedding.map(v => v / magPost);
	const expectedLen = normPost.length;
	let algorithmScore = 0;
	const reasons = [];

	//Semantic boost using pre-normalized embeddings
	if (normalizedBoost && normalizedBoost.length > 0) {
		const sims = [];
		for (const bv of normalizedBoost) {
			if (bv.length === expectedLen) {
				sims.push(fastCosineSimilarity(normPost, bv));
			}
		}
		if (sims.length > 0) {
			sims.sort((a, b) => b - a);
			const top = sims.slice(0, 5);
			const boostScore = top.reduce((a, b) => a + b, 0) * 20;
			algorithmScore += boostScore;
			if (boostScore > 1) {
				reasons.push(`Matches boosted topics (+${boostScore.toFixed(1)})`);
			}
		}
	}

	//Semantic suppress using pre-normalized embeddings
	if (normalizedSuppress && normalizedSuppress.length > 0) {
		const sims = [];
		for (const sv of normalizedSuppress) {
			if (sv.length === expectedLen) {
				sims.push(fastCosineSimilarity(normPost, sv));
			}
		}
		if (sims.length > 0) {
			sims.sort((a, b) => b - a);
			const top = sims.slice(0, 5);
			const suppressScore = top.reduce((a, b) => a + b, 0) * 20;
			algorithmScore -= suppressScore;
			if (suppressScore > 1) {
				reasons.push(`Suppressed topic (-${suppressScore.toFixed(1)})`);
			}
		}
	}

	//Sentiment alignment
	const postSentiment = typeof post.sentiment_score === 'number' ? post.sentiment_score : 0;
	const sentimentDistance = Math.abs(postSentiment - sentiment);
	const sentimentScore = (0.5 - sentimentDistance) * 10;
	algorithmScore += sentimentScore;
	if (Math.abs(sentimentScore) > 2) {
		reasons.push(`Sentiment match (${sentimentScore > 0 ? '+' : ''}${sentimentScore.toFixed(1)})`);
	}

	//Variety scoring using pre-computed weights
	if (normalisedRecentEmbeddings.length > 0 && normPost.length > 0 && totalWeight > 0) {
		let weightedSum = 0;
		for (let i = 0; i < normalisedRecentEmbeddings.length; i++) {
			const vectorEmbedding = normalisedRecentEmbeddings[i];
			if (vectorEmbedding.length === normPost.length) {
				weightedSum += fastCosineSimilarity(normPost, vectorEmbedding) * recentWeights[i];
			}
		}
		const similarityScore = Math.max(0, Math.min(1, weightedSum));
		const targetSimilarity = 0.6 * (1 - variety) + 0.1 * variety;
		const similarityDelta = targetSimilarity - similarityScore;
		const varietyScore = similarityDelta * 30;
		algorithmScore += varietyScore;
		if (Math.abs(varietyScore) > 2) {
			const varietyLabel = variety > 0.6 ? 'Diverse content' : variety < 0.4 ? 'Similar to liked' : 'Balanced variety';
			reasons.push(`${varietyLabel} (${varietyScore > 0 ? '+' : ''}${varietyScore.toFixed(1)})`);
		}
	}

	//Recency boost - heavily favor recent posts
	const postTime = new Date(post.created_at || post.created_at_remote).getTime();
	const ageInHours = (Date.now() - postTime) / (1000 * 60 * 60);
	const recencyBoost = 20 * Math.exp(-ageInHours / 12);
	algorithmScore += recencyBoost;
	const ageLabel = ageInHours < 1 ? 'Very recent' :
					ageInHours < 6 ? 'Recent' :
					ageInHours < 24 ? 'Today' :
					ageInHours < 168 ? 'This week' : 'Older';
	reasons.push(`${ageLabel} (+${recencyBoost.toFixed(1)})`);

	//Controversy score (-1 to 1): boost/suppress controversial posts
	//Only works for native posts with separate up/downvote counts
    if (controversyScore !== 0 && !post.isExternal && typeof post.upvotes === 'number' && typeof post.downvotes === 'number') {
        const totalVotes = post.upvotes + post.downvotes;
        if (totalVotes > 10) {
            const ratio = Math.min(post.upvotes, post.downvotes) / totalVotes;
            const controversyLevel = 1 - Math.abs(0.5 - ratio) * 2;
            const controversyAdjustment = controversyScore * controversyLevel * 15;
            algorithmScore += controversyAdjustment;
            if (Math.abs(controversyAdjustment) > 1) {
                const label = controversyScore > 0 ? 'Controversial' : 'Consensus-based';
                reasons.push(`${label} (${controversyAdjustment > 0 ? '+' : ''}${controversyAdjustment.toFixed(1)})`);
            }
        }
    }

	//Political viewpoint scoring
	if (normalizedPolitical && normalizedPolitical.length === expectedLen && politicalDisagreement > 0) {
		const similarity = fastCosineSimilarity(normPost, normalizedPolitical);
		const effectiveSimilarity = similarity * (1 - 2 * politicalDisagreement);
		const politicalScore = effectiveSimilarity * 15;
		algorithmScore += politicalScore;
		if (Math.abs(politicalScore) > 1) {
			const label = politicalScore > 0 ? 'Aligns with views' : 'Challenges views';
			reasons.push(`${label} (${politicalScore > 0 ? '+' : ''}${politicalScore.toFixed(1)})`);
		}
	}

	//Account size preference (0 = small accounts, 0.5 = neutral, 1 = popular accounts)
	if (accountSizePreference !== 0.5 && typeof post.follower_count === 'number') {
		const logFollowers = Math.log10(Math.max(post.follower_count, 1) + 1);
		const normalizedSize = Math.min(logFollowers / 7, 1);
		const sizeAdjustment = (accountSizePreference - 0.5) * 2;
		const accountScore = sizeAdjustment * normalizedSize * 10;
		algorithmScore += accountScore;
		if (Math.abs(accountScore) > 1) {
			const sizeLabel = post.follower_count < 100 ? 'Small account' :
							post.follower_count < 1000 ? 'Growing account' :
							post.follower_count < 10000 ? 'Established account' : 'Popular account';
			reasons.push(`${sizeLabel} (${accountScore > 0 ? '+' : ''}${accountScore.toFixed(1)})`);
		}
	}

	//Author diversity (0 = concentrated, 0.5 = neutral, 1 = diverse)
	if (authorDiversity > 0.5 && authorKey && authorCounts[authorKey]) {
		const authorCount = authorCounts[authorKey];
		const diversityPenalty = (authorDiversity - 0.5) * 2 * Math.log(authorCount + 1) * 5;
		algorithmScore -= diversityPenalty;
		if (diversityPenalty > 1) {
			reasons.push(`Author variety (-${diversityPenalty.toFixed(1)})`);
		}
	}

	//Source diversity (0 = focused, 0.5 = neutral, 1 = diverse)
	if (sourceDiversity > 0.5 && sourceKey && sourceCounts[sourceKey]) {
		const sourceCount = sourceCounts[sourceKey];
		const diversityPenalty = (sourceDiversity - 0.5) * 2 * Math.log(sourceCount + 1) * 5;
		algorithmScore -= diversityPenalty;
		if (diversityPenalty > 1) {
			reasons.push(`Source variety (-${diversityPenalty.toFixed(1)})`);
		}
	}

	//Return score with comprehensive reasons
	if (reasons.length === 0) {
		reasons.push('Default ranking');
	}
	return { score: algorithmScore, reasons };
}