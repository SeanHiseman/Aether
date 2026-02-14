export async function fetchMastodonAccountPosts(accountId, accessToken, instanceUrl, maxId = null, limit = 40) {
	try {
		const params = `limit=${Math.min(limit, 40)}&exclude_reblogs=true${maxId ? `&max_id=${maxId}` : ''}`;
		const url = `${instanceUrl}/api/v1/accounts/${encodeURIComponent(accountId)}/statuses?${params}`;
		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
		if (!response.ok) {
			const errorText = await response.text();
			console.error(new Date().toISOString(), '[fetchMastodonAccountPosts] Error response body:', errorText);
			throw new Error(`Mastodon API error: ${response.status} - ${errorText}`);
		}
		const data = await response.json();
		return data;
	} catch (error) {
		console.error(new Date().toISOString(), '[fetchMastodonAccountPosts] error:', error);
		throw error;
	}
}