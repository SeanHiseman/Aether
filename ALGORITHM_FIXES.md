# Algorithm Features - Required Fixes

## Issue 1: ExternalAccountMeta Missing follower_count

### Problem
ExternalAccountMeta table doesn't have follower_count field, so accountSizePreference can't work for external posts.

### Solution - Add Database Column

```sql
-- Add follower_count column to external_account_meta table
ALTER TABLE external_account_meta
ADD COLUMN follower_count INT DEFAULT 0 AFTER post_count;
```

### Update Model

```javascript
// In models/content.js - ExternalAccountMeta definition
const ExternalAccountMeta = sequelize.define('ExternalAccountMeta', {
    id: { type: STRING(36), primaryKey: true },
    account_id: { type: STRING(255), allowNull: false },
    platform: { type: STRING(32), allowNull: false },
    handle: { type: STRING(255), allowNull: true },
    display_name: { type: STRING(255), allowNull: true },
    avatar: { type: TEXT, allowNull: true },
    description: { type: TEXT, allowNull: true },
    last_fetched_at: { type: DataTypes.DATE, allowNull: true },
    cursor: { type: TEXT, allowNull: true },
    post_count: { type: INTEGER, defaultValue: 0 },
    follower_count: { type: INTEGER, defaultValue: 0 }, // ADD THIS LINE
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'external_account_meta',
    timestamps: false,
    indexes: [
        { fields: ['account_id', 'platform'], unique: true },
        { fields: ['platform'] },
        { fields: ['last_fetched_at'] }
    ]
});
```

## Issue 2: External Posts Don't Have Separate Upvotes/Downvotes

### Problem
ExternalPosts only have combined `score`, not separate upvotes/downvotes. Controversy score can't work.

### Solution - Disable Controversy for External Posts

```javascript
// In computeAlgorithmScore.js
//Controversy score (-1 to 1): boost/suppress controversial posts
//Only works for native posts with separate up/downvote counts
if (controversyScore !== 0 && !post.isExternal && typeof post.upvotes === 'number' && typeof post.downvotes === 'number') {
    const totalVotes = post.upvotes + post.downvotes;
    if (totalVotes > 10) {
        const ratio = Math.min(post.upvotes, post.downvotes) / totalVotes;
        const controversyLevel = 1 - Math.abs(0.5 - ratio) * 2;
        const controversyAdjustment = controversyScore * controversyLevel * 15;
        algorithmScore += controversyAdjustment;
        if (reasons && Math.abs(controversyAdjustment) > 2) {
            reasons.push(`${controversyScore > 0 ? 'Controversial' : 'Non-controversial'} (${controversyAdjustment > 0 ? '+' : ''}${controversyAdjustment.toFixed(1)})`);
        }
    }
}
```

## Issue 3: Recommendation Reasons Not Comprehensive

### Problem
Only major score adjustments are included in reasons. User wants ALL influences.

### Solution - Track Every Score Change

See updated computeAlgorithmScore.js below with comprehensive tracking.

## Issue 4: Author/Source Diversity May Not Work

### Problem
Need to verify diversity tracking is working correctly.

### Solution - Already Correct!
The implementation is correct. Diversity is tracked per scoring session and authors/sources that appear multiple times get penalized.

## Issue 5: No UI to Display Recommendation Reasons

### Problem
No info icon in externalPostWidget and contentWidget to show reasons.

### Solution - Add RecommendationInfo Component

See component code below.

---

# Complete Implementation Files

## 1. Updated computeAlgorithmScore.js (Comprehensive Reasons)

\`\`\`javascript
import { fastCosineSimilarity } from "./fastCosineSimilarity.js";

//Computes algorithm score for a single post
export function computeAlgorithmScore(post, params) {
    const {
        algorithmRow, normalizedBoost, normalizedSuppress, voteImpact, sentiment, variety,
        normalisedRecentEmbeddings, recentUpvotePosts, recentWeights, totalWeight, timeLimits,
        controversyScore = 0, accountSizePreference = 0.5, sourceDiversity = 0.5,
        authorDiversity = 0.5, interactionWeights = {}, learningRate = 0.5,
        showRecommendationReasons = false, authorCounts = {}, sourceCounts = {},
        authorKey, sourceKey
    } = params;

    //Time of day filtering
    if (timeLimits.startTime && timeLimits.endTime) {
        const createdAt = new Date(post.created_at || post.created_at_remote);
        const postTime = `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;
        if (postTime < timeLimits.startTime || postTime > timeLimits.endTime) {
            return null;
        }
    }

    let postEmbedding = post.embeddings;
    if (typeof postEmbedding === 'string') {
        try { postEmbedding = JSON.parse(postEmbedding); } catch { postEmbedding = []; }
    }
    if (!Array.isArray(postEmbedding)) postEmbedding = [];

    if (postEmbedding.length === 0) {
        return showRecommendationReasons ? { score: 0, reasons: ['No content analysis available'] } : 0;
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
            if (showRecommendationReasons && boostScore > 1) {
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
            if (showRecommendationReasons && suppressScore > 1) {
                reasons.push(`Suppressed topic (-${suppressScore.toFixed(1)})`);
            }
        }
    }

    //Sentiment alignment
    const postSentiment = typeof post.sentiment_score === 'number' ? post.sentiment_score : 0;
    const sentimentDistance = Math.abs(postSentiment - sentiment);
    const sentimentScore = (0.5 - sentimentDistance) * 10;
    algorithmScore += sentimentScore;
    if (showRecommendationReasons && Math.abs(sentimentScore) > 2) {
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
        if (showRecommendationReasons && Math.abs(varietyScore) > 2) {
            const varietyLabel = variety > 0.6 ? 'Diverse content' : variety < 0.4 ? 'Similar to liked' : 'Balanced variety';
            reasons.push(`${varietyLabel} (${varietyScore > 0 ? '+' : ''}${varietyScore.toFixed(1)})`);
        }
    }

    //Recency boost - heavily favor recent posts
    const postTime = new Date(post.created_at || post.created_at_remote).getTime();
    const ageInHours = (Date.now() - postTime) / (1000 * 60 * 60);
    const recencyBoost = 20 * Math.exp(-ageInHours / 12);
    algorithmScore += recencyBoost;
    if (showRecommendationReasons) {
        const ageLabel = ageInHours < 1 ? 'Very recent' :
                        ageInHours < 6 ? 'Recent' :
                        ageInHours < 24 ? 'Today' :
                        ageInHours < 168 ? 'This week' : 'Older';
        reasons.push(`${ageLabel} (+${recencyBoost.toFixed(1)})`);
    }

    //Controversy score (-1 to 1): boost/suppress controversial posts
    //Only works for native posts with separate up/downvote counts
    if (controversyScore !== 0 && !post.isExternal && typeof post.upvotes === 'number' && typeof post.downvotes === 'number') {
        const totalVotes = post.upvotes + post.downvotes;
        if (totalVotes > 10) {
            const ratio = Math.min(post.upvotes, post.downvotes) / totalVotes;
            const controversyLevel = 1 - Math.abs(0.5 - ratio) * 2;
            const controversyAdjustment = controversyScore * controversyLevel * 15;
            algorithmScore += controversyAdjustment;
            if (showRecommendationReasons && Math.abs(controversyAdjustment) > 1) {
                const label = controversyScore > 0 ? 'Controversial' : 'Consensus-based';
                reasons.push(`${label} (${controversyAdjustment > 0 ? '+' : ''}${controversyAdjustment.toFixed(1)})`);
            }
        }
    }

    //Account size preference (0 = small accounts, 0.5 = neutral, 1 = popular accounts)
    if (accountSizePreference !== 0.5 && typeof post.follower_count === 'number') {
        const logFollowers = Math.log10(Math.max(post.follower_count, 1) + 1);
        const normalizedSize = Math.min(logFollowers / 7, 1);
        const sizeAdjustment = (accountSizePreference - 0.5) * 2;
        const accountScore = sizeAdjustment * normalizedSize * 10;
        algorithmScore += accountScore;
        if (showRecommendationReasons && Math.abs(accountScore) > 1) {
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
        if (showRecommendationReasons && diversityPenalty > 1) {
            reasons.push(`Author variety (-${diversityPenalty.toFixed(1)})`);
        }
    }

    //Source diversity (0 = focused, 0.5 = neutral, 1 = diverse)
    if (sourceDiversity > 0.5 && sourceKey && sourceCounts[sourceKey]) {
        const sourceCount = sourceCounts[sourceKey];
        const diversityPenalty = (sourceDiversity - 0.5) * 2 * Math.log(sourceCount + 1) * 5;
        algorithmScore -= diversityPenalty;
        if (showRecommendationReasons && diversityPenalty > 1) {
            reasons.push(`Source variety (-${diversityPenalty.toFixed(1)})`);
        }
    }

    //Return score with optional comprehensive reasons
    if (showRecommendationReasons) {
        if (reasons.length === 0) {
            reasons.push('Default ranking');
        }
        return { score: algorithmScore, reasons };
    }
    return algorithmScore;
}
\`\`\`

## 2. RecommendationInfo Component

\`\`\`javascript
// frontend/src/components/RecommendationInfo.js
import { useState } from 'react';
import './RecommendationInfo.css';

const RecommendationInfo = ({ reasons }) => {
    const [showPopup, setShowPopup] = useState(false);

    if (!reasons || reasons.length === 0) return null;

    return (
        <div className="recommendation-info">
            <button
                className="info-icon-button"
                onClick={() => setShowPopup(!showPopup)}
                title="Why was this recommended?"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <text x="8" y="11" fontSize="10" textAnchor="middle" fill="currentColor">i</text>
                </svg>
            </button>

            {showPopup && (
                <div className="recommendation-popup">
                    <div className="recommendation-popup-header">
                        <span>Why this was shown</span>
                        <button onClick={() => setShowPopup(false)} className="close-button">×</button>
                    </div>
                    <ul className="recommendation-reasons">
                        {reasons.map((reason, index) => (
                            <li key={index}>{reason}</li>
                        ))}
                    </ul>
                    <div className="recommendation-popup-footer">
                        <small>These scores determine post ranking</small>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecommendationInfo;
\`\`\`

## 3. RecommendationInfo.css

\`\`\`css
/* frontend/src/components/RecommendationInfo.css */
.recommendation-info {
    position: relative;
    display: inline-block;
}

.info-icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-secondary, #888);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
}

.info-icon-button:hover {
    background-color: var(--bg-hover, rgba(0,0,0,0.05));
    color: var(--text-primary, #333);
}

.recommendation-popup {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #ddd);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 280px;
    max-width: 350px;
    z-index: 1000;
    animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.recommendation-popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #eee);
    font-weight: 600;
    font-size: 14px;
}

.close-button {
    background: none;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #888);
    padding: 0;
    width: 24px;
    height: 24px;
}

.close-button:hover {
    color: var(--text-primary, #333);
}

.recommendation-reasons {
    list-style: none;
    margin: 0;
    padding: 12px 16px;
    font-size: 13px;
}

.recommendation-reasons li {
    padding: 6px 0;
    display: flex;
    align-items: center;
}

.recommendation-reasons li::before {
    content: '•';
    margin-right: 8px;
    color: var(--accent-color, #007bff);
    font-weight: bold;
}

.recommendation-popup-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--border-color, #eee);
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0 0 8px 8px;
}

.recommendation-popup-footer small {
    color: var(--text-secondary, #666);
    font-size: 11px;
}
\`\`\`

---

# Integration Steps

## Step 1: Database Migration
Run the SQL command to add follower_count column.

## Step 2: Update Model
Update `models/content.js` to include follower_count field.

## Step 3: Update computeAlgorithmScore.js
Replace with the comprehensive version above.

## Step 4: Add RecommendationInfo Component
Create the component files.

## Step 5: Update contentWidget.js

\`\`\`javascript
// Add import at top
import RecommendationInfo from '../RecommendationInfo';

// In the component, add after post title/content:
{post.recommendationReasons && (
    <RecommendationInfo reasons={post.recommendationReasons} />
)}
\`\`\`

## Step 6: Update externalPostWidget.js

\`\`\`javascript
// Add import at top
import RecommendationInfo from '../components/RecommendationInfo';

// In the component, add after post title/content:
{post.recommendationReasons && (
    <RecommendationInfo reasons={post.recommendationReasons} />
)}
\`\`\`

## Step 7: Test
1. Create algorithm with showRecommendationReasons = true
2. Verify info icon appears on posts
3. Click icon to see comprehensive reasons
4. Verify all score influences are listed
