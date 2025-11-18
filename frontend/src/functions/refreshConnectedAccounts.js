import api from "../api";

export async function refreshConnectedAccounts() {
    try {
        const response = await api.get('/connected-accounts');
        if (response.data?.success) {
            localStorage.setItem(
                "connectedAccounts",
                JSON.stringify(response.data.accounts || [])
            );
        }
    } catch (error) {
        console.log("Failed to refresh connected accounts", error);
    }
}