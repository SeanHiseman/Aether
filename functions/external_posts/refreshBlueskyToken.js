import { ConnectedAccounts } from '../../models/users.js';

/**
 * Refresh an expired Bluesky access token using the refresh token
 */
export async function refreshBlueskyToken(userId) {
	try {
		console.log('[refreshBlueskyToken] Refreshing token for user:', userId);

		const account = await ConnectedAccounts.findOne({
			where: { user_id: userId, platform: 'bluesky' }
		});

		if (!account || !account.refresh_token) {
			console.log('[refreshBlueskyToken] No account or refresh token found');
			return null;
		}

		console.log('[refreshBlueskyToken] Calling Bluesky refresh endpoint');
		const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${account.refresh_token}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[refreshBlueskyToken] Failed to refresh:', response.status, errorText);
			return null;
		}

		const json = await response.json();
		console.log('[refreshBlueskyToken] Successfully refreshed token');

		// Update the stored tokens
		await ConnectedAccounts.update(
			{
				access_token: json.accessJwt,
				refresh_token: json.refreshJwt
			},
			{
				where: { user_id: userId, platform: 'bluesky' }
			}
		);

		console.log('[refreshBlueskyToken] Updated tokens in database');

		return {
			accessToken: json.accessJwt,
			refreshToken: json.refreshJwt
		};
	} catch (error) {
		console.error('[refreshBlueskyToken] Error:', error);
		return null;
	}
}
