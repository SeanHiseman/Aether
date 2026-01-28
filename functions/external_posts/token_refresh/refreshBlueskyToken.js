import { ConnectedAccounts } from "../../../models/users.js";

export async function refreshBlueskyToken(user_id) {
    try {
        //console.log(new Date().toISOString(), '[refreshBlueskyToken] Attempting to refresh token for user:', user_id);
        const account = await ConnectedAccounts.findOne({
            where: { user_id, platform: 'bluesky' }
        });
        if (!account?.refresh_token) {
            console.log(new Date().toISOString(), '[refreshBlueskyToken] No refresh token found');
            return null;
        }
        const tokenResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${account.refresh_token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(new Date().toISOString(), '[refreshBlueskyToken] Failed to refresh token:', tokenResponse.status, errorText);
            return null;
        }
        const tokenJson = await tokenResponse.json();
        //console.log(new Date().toISOString(), '[refreshBlueskyToken] Token refreshed successfully');
        await ConnectedAccounts.update({
            access_token: tokenJson.accessJwt,
            refresh_token: tokenJson.refreshJwt,
            account_id: tokenJson.did,
            extra: JSON.stringify(tokenJson)
        }, { where: { user_id, platform: 'bluesky' } });
        return tokenJson.accessJwt;
    } catch (error) {
        console.error(new Date().toISOString(), '[refreshBlueskyToken] Error:', error);
        return null;
    }
}