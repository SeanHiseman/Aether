export async function fetchBlueskyAccountPosts(accountId, accessToken, cursor = null, limit = 100) {
    try {
        const url = cursor
            ? `https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(accountId)}&limit=${Math.min(limit, 100)}&cursor=${cursor}`
            : `https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(accountId)}&limit=${Math.min(limit, 100)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(new Date().toISOString(), '[fetchBlueskyAccountPosts] Error response body:', errorText);
            throw new Error(`Bluesky API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(new Date().toISOString(), '[fetchBlueskyAccountPosts] error:', error);
        throw error;
    }
}