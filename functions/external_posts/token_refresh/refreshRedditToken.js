import { ConnectedAccounts } from "../../../models/users.js";

export async function refreshRedditToken(user_id) {
	try {
		const account = await ConnectedAccounts.findOne({
			where: { user_id, platform: 'reddit' }
		});
		if (!account?.refresh_token) {
			return null;
		}
		const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: account.refresh_token
			})
		});
		if (!tokenResponse.ok) {
			console.error('Failed to refresh Reddit token:', tokenResponse.status);
			return null;
		}
		const tokenJson = await tokenResponse.json();
		await ConnectedAccounts.update({
			access_token: tokenJson.access_token,
			refresh_token: tokenJson.refresh_token || account.refresh_token,
			extra: JSON.stringify(tokenJson)
		}, { where: { user_id, platform: 'reddit' } });
		return tokenJson.access_token;
	} catch (error) {
		console.error('Error refreshing Reddit token:', error);
		return null;
	}
}