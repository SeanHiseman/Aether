# Implementing Learning Features - Comprehensive Guide

## Overview
The current implementation provides the **structure** for learning, but doesn't actually track and adapt to user behavior over time. This guide explains how to implement true adaptive learning.

## What's Currently Implemented ✅

1. **learningRate** - Controls time-weighting of recent upvotes
2. **interactionWeights** - Structure for different interaction types (only upvotes currently used)
3. **Variety scoring** - Compares posts to recently upvoted content

## What Needs to Be Implemented 🔨

### 1. User Interaction Tracking

Create a comprehensive interaction tracking system:

```javascript
// models/userInteractions.js
const UserInteractions = sequelize.define('user_interactions', {
    interaction_id: { type: STRING(36), primaryKey: true },
    user_id: { type: STRING(36), allowNull: false },
    post_id: { type: STRING(36), allowNull: false },
    interaction_type: {
        type: ENUM('upvote', 'downvote', 'comment', 'share', 'save', 'view'),
        allowNull: false
    },
    duration_seconds: { type: INTEGER, allowNull: true }, // For view duration
    created_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
    tableName: 'user_interactions',
    timestamps: false,
    indexes: [
        { fields: ['user_id', 'created_at'] },
        { fields: ['post_id'] },
        { fields: ['interaction_type'] }
    ]
});
```

### 2. Track View Duration

Add client-side tracking:

```javascript
// frontend/src/hooks/useViewTracking.js
export const useViewTracking = (postId, userId) => {
    useEffect(() => {
        const startTime = Date.now();
        let isVisible = true;

        const handleVisibilityChange = () => {
            isVisible = !document.hidden;
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            const duration = Math.floor((Date.now() - startTime) / 1000);

            if (duration > 2) { // Only track if viewed for 2+ seconds
                api.post('/track_interaction', {
                    postId,
                    interactionType: 'view',
                    durationSeconds: duration
                });
            }
        };
    }, [postId, userId]);
};
```

### 3. Update Interaction Tracking Endpoint

```javascript
// routes/interactionRoutes.js
router.post('/track_interaction', authenticateCheck, async (req, res) => {
    try {
        const { postId, interactionType, durationSeconds } = req.body;
        const userId = req.session.user_id;

        await UserInteractions.create({
            interaction_id: v4(),
            user_id: userId,
            post_id: postId,
            interaction_type: interactionType,
            duration_seconds: durationSeconds || null
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('track_interaction error:', error);
        res.status(500).json({ success: false });
    }
});
```

### 4. Fetch Weighted Interactions for Scoring

Update `applyAlgorithm.js` to fetch ALL interaction types:

```javascript
// In applyAlgorithm.js - replace the current upvote fetching
if (algorithmLocation) {
    const interactionTypes = ['upvote', 'comment', 'share', 'save', 'view'];
    const rawInteractions = await UserInteractions.findAll({
        attributes: ['post_id', 'interaction_type', 'duration_seconds', 'created_at'],
        where: {
            user_id: userId,
            interaction_type: { [Op.in]: interactionTypes }
        },
        order: [['created_at', 'DESC']],
        limit: limit * 2, // Get more to account for different types
        raw: true
    });

    // Group by post_id and calculate weighted score
    const postInteractionMap = new Map();

    for (const interaction of rawInteractions) {
        const postId = interaction.post_id;
        const current = postInteractionMap.get(postId) || {
            post_id: postId,
            score: 0,
            created_at: interaction.created_at
        };

        // Apply interaction weights
        const weights = interactionWeights || {
            upvotes: 0.3,
            comments: 0.25,
            shares: 0.2,
            saves: 0.15,
            viewDuration: 0.1
        };

        switch (interaction.interaction_type) {
            case 'upvote':
                current.score += weights.upvotes;
                break;
            case 'comment':
                current.score += weights.comments;
                break;
            case 'share':
                current.score += weights.shares;
                break;
            case 'save':
                current.score += weights.saves;
                break;
            case 'view':
                // Weight based on duration (max 5 minutes = full weight)
                const viewScore = Math.min(interaction.duration_seconds / 300, 1);
                current.score += weights.viewDuration * viewScore;
                break;
        }

        postInteractionMap.set(postId, current);
    }

    // Get top posts by weighted score
    const sortedPosts = Array.from(postInteractionMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    recentUpvoteIds = sortedPosts.map(p => p.post_id);
    // Continue with embedding fetching...
}
```

### 5. Implement Learning Rate with Exponential Moving Average

Update the weight calculation in `scoreAndPaginateCandidates.js`:

```javascript
// Calculate time-weighted preferences using exponential moving average
if (recentUpvotePosts && recentUpvotePosts.length > 0) {
    const now = Date.now();
    const halfLife = learningRate === 1.0 ? 1 : (1 - learningRate) * 30; // Days
    const lambda = Math.log(2) / (halfLife * 86400000); // Convert to milliseconds

    recentWeights = recentUpvotePosts.map((p, index) => {
        const age = now - new Date(p.updated_at || p.created_at).getTime();

        // Exponential decay: w(t) = e^(-λt)
        const timeWeight = Math.exp(-lambda * age);

        // Also apply recency boost for very recent interactions
        const recencyBoost = age < 86400000 ? 1.5 : 1; // 1.5x for last 24h

        return timeWeight * recencyBoost;
    });

    totalWeight = recentWeights.reduce((a, b) => a + b, 0) || 1;
    recentWeights = recentWeights.map(w => w / totalWeight);
}
```

### 6. Create User Preference Profile

Build a persistent user profile that stores learned preferences:

```javascript
// models/userPreferences.js
const UserPreferences = sequelize.define('user_preferences', {
    preference_id: { type: STRING(36), primaryKey: true },
    user_id: { type: STRING(36), allowNull: false, unique: true },

    // Learned topic preferences (embeddings)
    preferred_topics: { type: JSON, allowNull: true }, // Array of embeddings
    avoided_topics: { type: JSON, allowNull: true },

    // Content type preferences
    content_preferences: { type: JSON, allowNull: true }, // { images: 0.8, videos: 0.3, text: 0.9 }

    // Optimal posting time preferences
    active_hours: { type: JSON, allowNull: true }, // [14, 15, 16, 20, 21] - hours user is most active

    // Author/source preferences
    preferred_authors: { type: JSON, allowNull: true }, // Map of author_id: preference_score
    preferred_sources: { type: JSON, allowNull: true },

    // Engagement patterns
    avg_view_duration: { type: FLOAT, allowNull: true },
    engagement_velocity: { type: FLOAT, allowNull: true }, // How quickly user engages

    last_updated: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
    tableName: 'user_preferences',
    timestamps: false
});
```

### 7. Periodic Profile Update (Background Job)

Create a cron job to update user profiles:

```javascript
// jobs/updateUserProfiles.js
import cron from 'node-cron';

// Run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
    console.log('Updating user preference profiles...');

    const users = await Users.findAll({
        attributes: ['user_id'],
        limit: 1000 // Process in batches
    });

    for (const user of users) {
        await updateUserProfile(user.user_id);
    }
});

async function updateUserProfile(userId) {
    // Get last 90 days of interactions
    const interactions = await UserInteractions.findAll({
        where: {
            user_id: userId,
            created_at: { [Op.gte]: new Date(Date.now() - 90 * 86400000) }
        },
        include: [{
            model: Posts,
            as: 'post',
            attributes: ['embeddings', 'word_count', 'has_images', 'has_videos', 'poster_id', 'feed_id']
        }]
    });

    // Calculate content type preferences
    const contentScores = { images: 0, videos: 0, text: 0 };
    let totalWeight = 0;

    for (const interaction of interactions) {
        const weight = getInteractionWeight(interaction);
        totalWeight += weight;

        if (interaction.post.has_images) contentScores.images += weight;
        if (interaction.post.has_videos) contentScores.videos += weight;
        if (interaction.post.word_count > 50) contentScores.text += weight;
    }

    // Normalize scores
    if (totalWeight > 0) {
        Object.keys(contentScores).forEach(key => {
            contentScores[key] /= totalWeight;
        });
    }

    // Extract preferred topics from embeddings
    const preferredEmbeddings = interactions
        .filter(i => ['upvote', 'comment', 'share', 'save'].includes(i.interaction_type))
        .map(i => i.post.embeddings)
        .filter(Boolean);

    // Calculate centroid of preferred topics
    const preferredTopics = calculateCentroid(preferredEmbeddings);

    // Update or create user preference profile
    await UserPreferences.upsert({
        preference_id: v4(),
        user_id: userId,
        preferred_topics: preferredTopics,
        content_preferences: contentScores,
        last_updated: new Date()
    });
}
```

### 8. Use Profile in Scoring

Integrate learned preferences into `computeAlgorithmScore.js`:

```javascript
// Add to scoring params
const userProfile = await UserPreferences.findOne({
    where: { user_id: userId }
});

if (userProfile && learningRate > 0.3) {
    // Apply learned topic preferences
    if (userProfile.preferred_topics && postEmbedding.length > 0) {
        const similarity = fastCosineSimilarity(normPost, userProfile.preferred_topics);
        const profileBoost = similarity * learningRate * 15;
        algorithmScore += profileBoost;

        if (reasons && profileBoost > 3) {
            reasons.push(`Matches your interests (+${profileBoost.toFixed(1)})`);
        }
    }

    // Apply content type preferences
    if (userProfile.content_preferences) {
        let contentBoost = 0;
        if (post.has_images) contentBoost += userProfile.content_preferences.images * 5;
        if (post.has_videos) contentBoost += userProfile.content_preferences.videos * 5;
        if (post.word_count > 100) contentBoost += userProfile.content_preferences.text * 5;

        algorithmScore += contentBoost * learningRate;
    }
}
```

## Implementation Roadmap

### Phase 1: Basic Tracking (1-2 weeks)
1. ✅ Create user_interactions table
2. ✅ Add view duration tracking
3. ✅ Implement track_interaction endpoint
4. ✅ Update frontend to track all interactions

### Phase 2: Weighted Scoring (1 week)
1. ✅ Fetch all interaction types in applyAlgorithm
2. ✅ Apply interactionWeights to calculate scores
3. ✅ Update variety scoring to use weighted interactions
4. ✅ Test with different weight configurations

### Phase 3: Adaptive Learning (2-3 weeks)
1. ✅ Create user_preferences table
2. ✅ Implement profile update job
3. ✅ Build preference extraction algorithms
4. ✅ Integrate profiles into scoring
5. ✅ Add dashboard to view learned preferences

### Phase 4: Optimization (1-2 weeks)
1. ✅ Add caching for user profiles
2. ✅ Optimize embedding calculations
3. ✅ A/B test learning effectiveness
4. ✅ Fine-tune decay rates and weights

## Testing the Learning System

### 1. Unit Tests
```javascript
describe('Learning Rate', () => {
    it('should weight recent interactions more heavily at high learning rate', () => {
        const weights = calculateWeights(interactions, 0.9);
        expect(weights[0]).toBeGreaterThan(weights[weights.length - 1]);
    });

    it('should weight interactions equally at learning rate 0', () => {
        const weights = calculateWeights(interactions, 0);
        expect(new Set(weights).size).toBe(1);
    });
});
```

### 2. Integration Tests
- Track user interactions for 1 week
- Compare feed quality with/without learning
- Measure engagement metrics (CTR, dwell time, return rate)

### 3. A/B Testing
- Group A: learningRate = 0 (no learning)
- Group B: learningRate = 0.5 (balanced)
- Group C: learningRate = 1.0 (fully adaptive)

## Key Metrics to Track

1. **User Engagement**
   - Click-through rate (CTR)
   - Average view duration
   - Return visit frequency

2. **Algorithm Performance**
   - Prediction accuracy (predicted vs actual engagement)
   - Diversity score (variety of content shown)
   - Personalization score (how different from generic feed)

3. **User Satisfaction**
   - Algorithm adjustment frequency (are users happy with defaults?)
   - Feedback sentiment
   - Retention rate

## Advanced Features (Future)

### 1. Collaborative Filtering
Find users with similar preferences and recommend content they enjoyed

### 2. Temporal Patterns
Learn when users prefer different content types (news in morning, entertainment at night)

### 3. Context-Aware Learning
Adapt based on device, location, time of day

### 4. Explainable AI
Show users WHY content was recommended and let them provide feedback

### 5. Multi-Armed Bandit
Balance exploration (showing new types of content) vs exploitation (showing known preferences)

## Privacy Considerations

1. **Data Retention**: Only store interactions for 90 days
2. **User Control**: Allow users to view/delete their interaction history
3. **Transparency**: Show users what the algorithm has learned
4. **Opt-out**: Provide option to disable learning (learningRate = 0)

## Performance Optimization

1. **Batch Processing**: Update profiles in background, not real-time
2. **Caching**: Cache user profiles for 1 hour
3. **Sampling**: Use sample of interactions for very active users
4. **Incremental Updates**: Update profiles incrementally, not from scratch

## Conclusion

The learning features transform a static algorithm into an adaptive system that improves over time. The key is:

1. **Track everything** - All interactions, not just upvotes
2. **Weight appropriately** - Use interactionWeights to signal importance
3. **Adapt gradually** - Use learningRate to control adaptation speed
4. **Test rigorously** - Measure impact on engagement metrics
5. **Respect privacy** - Be transparent and give users control
