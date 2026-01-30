// Utility functions for tracking channel views using localStorage

const STORAGE_KEY = 'feedChannelViews';

/**
 * Get all channel views from localStorage
 * @returns {Object} Map of channelId -> last_seen_at timestamp
 */
export const getChannelViews = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Error reading channel views from localStorage:', error);
        return {};
    }
};

/**
 * Update the last seen timestamp for a channel
 * @param {string} channelId - The channel ID
 * @param {Date|string} timestamp - The timestamp (defaults to now)
 * @returns {void}
 */
export const updateChannelView = (channelId, timestamp = new Date()) => {
    try {
        const views = getChannelViews();
        views[channelId] = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } catch (error) {
        console.error('Error updating channel view in localStorage:', error);
    }
};

/**
 * Get the last seen timestamp for a specific channel
 * @param {string} channelId - The channel ID
 * @returns {string|null} ISO timestamp string or null if never viewed
 */
export const getChannelLastSeen = (channelId) => {
    const views = getChannelViews();
    return views[channelId] || null;
};

/**
 * Check if a channel has unread messages
 * @param {string} channelId - The channel ID
 * @param {string|Date} channelUpdatedAt - When the channel was last updated
 * @param {boolean} isChat - Whether the channel has chat enabled
 * @returns {boolean} True if channel has unread messages
 */
export const hasUnreadMessages = (channelId, channelUpdatedAt, isChat = true) => {
    if (!isChat) return false; // Don't show unread for non-chat channels

    const lastSeen = getChannelLastSeen(channelId);
    if (!lastSeen) return false; //Shouldn't happen since it is initialised on login, but default to no indicator

    try {
        const lastSeenDate = new Date(lastSeen);
        const updatedDate = new Date(channelUpdatedAt);
        return updatedDate > lastSeenDate;
    } catch (error) {
        console.error('Error comparing dates:', error);
        return false;
    }
};

/**
 * Clear all channel view data (e.g., on logout)
 * @returns {void}
 */
export const clearChannelViews = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing channel views:', error);
    }
};
