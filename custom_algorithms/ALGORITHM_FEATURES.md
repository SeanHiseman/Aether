# Algorithm Features Implementation

## Overview
This document describes the newly implemented algorithm features that were previously marked as "not yet implemented" in the frontend.

## Implemented Features

### 1. Reading Time Limits
**Frontend field:** `readingTimeRange` (min/max in seconds)
**Backend field:** `readingTimeLimits` (min/max in seconds)

- Filters posts based on estimated reading time
- Calculation: assumes 250 words per minute reading speed
- Converts seconds to word count for filtering
- Applied to both native Posts and ExternalPosts

**Location:**
- `applyAlgorithm.js` - algorithm filters
- Word count filter added for both SQL and Sequelize queries

### 2. Controversy Score
**Frontend field:** `controversyScore` (-1 to 1)
**Backend field:** `controversyScore` (-1 to 1)

- Controls exposure to controversial/divisive content
- Algorithm: Uses Wilson score to detect posts with both high upvotes AND downvotes
- -1 = avoid controversial content
- 0 = neutral (default)
- +1 = seek controversial content
- Only applies to posts with 10+ total votes

**Location:** `computeAlgorithmScore.js` - controversy calculation

### 3. Account Size Preference
**Frontend field:** `accountSizePreference` (0 to 1)
**Backend field:** `accountSizePreference` (0 to 1)

- Preferences for content from small vs large accounts
- Uses follower count from Feeds table and ExternalAccountMeta table
- 0 = prefer small accounts (< 100 followers)
- 0.5 = neutral (default)
- 1 = prefer popular accounts (10k+ followers)
- Logarithmic scaling for fair distribution

**Location:**
- `scoreAndPaginateCandidates.js` - fetches follower_count
- `computeAlgorithmScore.js` - applies preference scoring

### 4. Source Diversity
**Frontend field:** `sourceDiversity` (0 to 1)
**Backend field:** `sourceDiversity` (0 to 1)

- Controls variety of sources/communities shown
- Tracks which sources have already been shown in the current batch
- 0 = focused (allow repeated sources)
- 0.5 = neutral (default)
- 1 = diverse (penalize repeated sources)
- Source = feed_id, channel_id, or external platform (reddit, bluesky, mastodon)

**Location:**
- `scoreAndPaginateCandidates.js` - tracks source counts
- `computeAlgorithmScore.js` - applies diversity penalty

### 5. Author Diversity
**Frontend field:** `authorDiversity` (0 to 1)
**Backend field:** `authorDiversity` (0 to 1)

- Controls variety of content creators shown
- Tracks which authors have already been shown in the current batch
- 0 = concentrated (allow same author repeatedly)
- 0.5 = neutral (default)
- 1 = diverse (prevent feed domination by few accounts)
- Author = poster_id for native posts, author_did/author for external posts

**Location:**
- `scoreAndPaginateCandidates.js` - tracks author counts
- `computeAlgorithmScore.js` - applies diversity penalty

### 6. Learning Rate
**Frontend field:** `learningRate` (0 to 1)
**Backend field:** `learningRate` (0 to 1)

- Controls how quickly algorithm adapts to recent behavior
- Affects weighting of recent upvoted posts in variety scoring
- 0 = static (all historical upvotes weighted equally)
- 0.5 = balanced (default)
- 1 = adaptive (heavily favor most recent upvotes)
- Uses exponential decay based on interaction age

**Location:** `scoreAndPaginateCandidates.js` - weight calculation

### 7. Interaction Weights
**Frontend field:** `interactionWeights` (object with upvotes, comments, shares, saves, viewDuration)
**Backend field:** `interactionWeights` (object)

- Defines which actions tell the algorithm most about preferences
- Currently only upvotes are tracked, but structure is in place for future expansion
- Future implementation will use these weights when calculating variety scores
- All weights are relative to each other

**Location:** `applyAlgorithm.js` - passed to scoring params (future use)

### 8. Show Recommendation Reasons
**Frontend field:** `showRecommendationReasons` (boolean)
**Backend field:** `showRecommendationReasons` (boolean)

- When enabled, returns explanation of why each post was recommended
- Tracks which factors contributed to the score
- Returns array of reason strings with each post
- Examples: "Matches boosted topics (+15.3)", "Source variety (-3.2)"

**Location:**
- `computeAlgorithmScore.js` - tracks and returns reasons
- `scoreAndPaginateCandidates.js` - passes reasons through
- `fetchPaginatedPostData.js` - includes reasons in final posts

## Technical Implementation Details

### Data Flow
1. Frontend sends algorithm configuration via `/create_algorithm` endpoint
2. Backend stores configuration in `algorithm_code` JSON field
3. `applyAlgorithm.js` parses algorithm and passes parameters to scoring functions
4. `scoreAndPaginateCandidates.js` fetches additional data (follower counts, etc.)
5. `computeAlgorithmScore.js` applies all scoring factors
6. Final posts include `algorithmScore` and optional `recommendationReasons`

### Database Dependencies
- **Feeds table:** `follower_count` field for account size preference
- **ExternalAccountMeta table:** `follower_count` field for external accounts
- **Posts table:** `upvotes`, `downvotes`, `word_count` for scoring
- **ExternalPosts table:** `upvotes`, `downvotes`, `word_count` for scoring

### Performance Considerations
- Follower count fetching done in batches to minimize DB queries
- Diversity tracking done in-memory during scoring loop
- Pre-computed weights for variety scoring
- Maximum 500 candidates scored per request (already enforced)

## Future Enhancements

### Not Yet Implemented in Backend
These features are in the frontend UI but not yet used in backend scoring:
- **Interaction weights for non-upvote actions:** Currently only tracks upvotes
  - Will need to track comments, shares, saves, view duration
  - Requires additional database queries and tracking

### Potential Improvements
- Cache follower counts for better performance
- Add configurable diversity window (e.g., diversity per 10 posts vs per 100 posts)
- Add controversy score caching/pre-calculation
- Implement A/B testing for algorithm effectiveness
- Add algorithm performance metrics dashboard

## Testing Recommendations
1. Test reading time limits with various word counts
2. Test controversy score with posts having different vote ratios
3. Test account size preference with accounts of varying follower counts
4. Test diversity features with repeated authors/sources
5. Test learning rate with different interaction histories
6. Test showRecommendationReasons for clarity and accuracy
7. Test performance with maximum candidate counts

## Migration Notes
- No database migrations required (uses existing fields)
- Backward compatible (all new fields have defaults)
- Existing algorithms will continue to work with default values
- Algorithm code JSON structure extended but not breaking
