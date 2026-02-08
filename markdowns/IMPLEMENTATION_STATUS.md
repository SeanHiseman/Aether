# Algorithm Features - Implementation Status

## ✅ Fully Implemented (Backend Ready)

### 1. Controversy Score
- **Status**: ✅ Complete
- **Location**: `computeAlgorithmScore.js`
- **How it works**: Detects posts with balanced upvote/downvote ratios (controversial)
- **Range**: -1 (avoid) to 1 (seek controversial content)

### 2. Account Size Preference
- **Status**: ✅ Complete
- **Location**: `scoreAndPaginateCandidates.js`, `computeAlgorithmScore.js`
- **How it works**: Fetches follower counts, adjusts score based on account size
- **Range**: 0 (small accounts) to 1 (popular accounts)

### 3. Author Diversity
- **Status**: ✅ Complete
- **Location**: `scoreAndPaginateCandidates.js`, `computeAlgorithmScore.js`
- **How it works**: Tracks authors shown, penalizes repeats
- **Range**: 0 (concentrated) to 1 (diverse)

### 4. Source Diversity
- **Status**: ✅ Complete
- **Location**: `scoreAndPaginateCandidates.js`, `computeAlgorithmScore.js`
- **How it works**: Tracks sources (feeds/channels/platforms), penalizes repeats
- **Range**: 0 (focused) to 1 (diverse)

### 5. Reading Time Limits
- **Status**: ✅ Complete
- **Location**: `applyAlgorithm.js`
- **How it works**: Filters posts by word count (250 words/min)
- **Range**: minReadingTime to maxReadingTime (in seconds)

### 6. Show Recommendation Reasons
- **Status**: ✅ Complete
- **Location**: `computeAlgorithmScore.js`, `fetchPaginatedPostData.js`
- **How it works**: Returns explanation array with each post
- **Output**: `["Matches boosted topics (+15.3)", "Source variety (-3.2)"]`

### 7. Algorithm Storage
- **Status**: ✅ Complete
- **Location**: `algorithmRoutes.js`
- **How it works**: All new fields stored in `algorithm_code` JSON

## ⚠️ Partially Implemented (Structure Only)

### 8. Learning Rate
- **Current Status**: ⚠️ Structure exists, basic time-weighting implemented
- **What works**: Weights recent upvotes more heavily based on learningRate
- **What's missing**: Full adaptive learning system (see IMPLEMENTING_LEARNING.md)
- **Next steps**:
  1. Track all interaction types (comments, shares, saves, view duration)
  2. Build user preference profiles
  3. Implement background learning jobs

### 9. Interaction Weights
- **Current Status**: ⚠️ Structure exists, only upvotes currently tracked
- **What works**: Structure passed through to scoring functions
- **What's missing**: Tracking of comments, shares, saves, view duration
- **Next steps**:
  1. Create `user_interactions` table
  2. Add client-side view duration tracking
  3. Update scoring to use all interaction types

## 📊 Current Data Flow

```
Frontend (addAlgorithm.js)
    ↓
POST /create_algorithm
    ↓
algorithmRoutes.js - Extracts and validates fields
    ↓
Stores in algorithms.algorithm_code (JSON)
    ↓
applyAlgorithm.js - Parses algorithm_code
    ↓
Passes to scoreAndPaginateCandidates.js
    ↓
Calls computeAlgorithmScore.js for each post
    ↓
Returns scored posts with optional reasons
```

## 🔧 Files Modified

### Backend
1. ✅ `algorithmRoutes.js` - Extracts and stores new fields
2. ✅ `applyAlgorithm.js` - Parses and distributes new fields
3. ✅ `scoreAndPaginateCandidates.js` - Fetches follower counts, tracks diversity
4. ✅ `computeAlgorithmScore.js` - Implements all scoring features
5. ✅ `fetchPaginatedPostData.js` - Passes recommendation reasons

### Frontend
- ✅ Already complete in `addAlgorithm.js`

## 🧪 Testing Checklist

### Manual Testing
- [ ] Create algorithm with controversyScore = 1
  - Verify controversial posts ranked higher
- [ ] Create algorithm with accountSizePreference = 0
  - Verify small accounts ranked higher
- [ ] Create algorithm with authorDiversity = 1
  - Verify no author appears twice in a row
- [ ] Create algorithm with sourceDiversity = 1
  - Verify sources are well-mixed
- [ ] Create algorithm with readingTimeLimits
  - Verify posts filtered by word count
- [ ] Enable showRecommendationReasons
  - Verify reasons appear with posts
- [ ] Adjust learningRate
  - Verify recent upvotes weighted more at higher values

### Database Testing
- [ ] Verify algorithm_code JSON contains all new fields
- [ ] Verify boost/suppress embeddings still generated
- [ ] Verify existing algorithms still work

### Performance Testing
- [ ] Test with 500 candidates (max)
- [ ] Measure latency with follower count fetching
- [ ] Check for N+1 queries

## 🐛 Known Issues

1. **ExternalAccountMeta follower counts** - May be null/0 for new accounts
   - Solution: Default to 0, add background job to fetch

2. **Diversity tracking resets per request** - Doesn't persist across pages
   - This is by design for now
   - Future: Could store recent shown posts in session/cache

3. **Learning features incomplete** - Only basic time-weighting implemented
   - See IMPLEMENTING_LEARNING.md for full roadmap

## 📝 API Contract

### Request (POST /create_algorithm)
```javascript
{
    algorithmName: "My Algorithm",
    chronology: 0.6,
    voteImpact: 0.8,
    sentiment: 0.2,
    variety: 0.5,
    // ... existing fields ...

    // New fields
    learningRate: 0.5,
    interactionWeights: {
        upvotes: 0.3,
        comments: 0.25,
        shares: 0.2,
        saves: 0.15,
        viewDuration: 0.1
    },
    authorDiversity: 0.5,
    controversyScore: 0,
    minReadingTime: 60,
    maxReadingTime: 300,
    accountSizePreference: 0.5,
    sourceDiversity: 0.5,
    showRecommendationReasons: false
}
```

### Response (Algorithm Code)
```javascript
{
    chronology: 0.6,
    contentType: { images: true, text: true, videos: true },
    variety: 0.5,
    wordLimits: { min: 100, max: 5000 },
    videoLimits: { min: 30, max: 600 },
    readingTimeLimits: { min: 60, max: 300 },
    timeLimits: { startTime: "00:00", endTime: "23:59" },
    scoring: {
        sentiment: 0.2,
        voteImpact: 0.8,
        wordBoost: ["tech", "science"],
        wordSuppress: ["politics"]
    },
    learningRate: 0.5,
    interactionWeights: { ... },
    authorDiversity: 0.5,
    controversyScore: 0,
    accountSizePreference: 0.5,
    sourceDiversity: 0.5,
    showRecommendationReasons: false
}
```

### Post Output (with reasons)
```javascript
{
    post_id: "abc123",
    title: "Great Tech Article",
    algorithmScore: 45.7,
    recommendationReasons: [
        "Matches boosted topics (+15.3)",
        "Recent post (+12.5)",
        "Source variety (-3.2)"
    ]
    // ... other post fields ...
}
```

## 🚀 Next Steps

### Immediate (This Sprint)
1. ✅ Update algorithmRoutes.js ← **DONE**
2. ✅ Update scoring functions ← **DONE**
3. [ ] Test all features manually
4. [ ] Fix any bugs found

### Short Term (Next Sprint)
1. [ ] Implement user_interactions table
2. [ ] Add view duration tracking
3. [ ] Update applyAlgorithm to use all interaction types
4. [ ] Test weighted interaction scoring

### Long Term (Next Quarter)
1. [ ] Build user preference profiles
2. [ ] Implement background learning jobs
3. [ ] Add preference dashboard
4. [ ] A/B test learning effectiveness

## 📚 Documentation

- **ALGORITHM_FEATURES.md** - Overview of all features
- **IMPLEMENTING_LEARNING.md** - Complete guide to building learning system
- **IMPLEMENTATION_STATUS.md** - This file

## 💡 Tips

1. **Start with defaults**: Use learningRate = 0.5, all diversity scores = 0.5
2. **Test incrementally**: Enable one feature at a time
3. **Monitor performance**: Watch for slow queries with follower count fetches
4. **Use reasons**: Enable showRecommendationReasons during development to debug
5. **Gradual rollout**: Start with controversyScore and diversity features before tackling full learning system
