import crypto from 'crypto';
import { escapeHtml } from '../../escapeHtml.js';

export async function GenerateRedditHTML(textBody, mediaArray) {
    try {
        const mediaItems = Array.isArray(mediaArray)
            ? mediaArray
            : mediaArray
                ? [mediaArray]
                : [];
        let html = '';
        if (textBody && textBody.trim()) {
            html += `
                <div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
                    <p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        for (const media of mediaItems) {
            const url = media?.source?.url?.replace(/&amp;/g, '&');
            if (!url) continue;
            html += `
                <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                    <img src="${url}" alt="Reddit media" />
                </div>
            `;
        }
        return html.trim();
    } catch (error) {
        console.error(new Date().toISOString(), 'generateRedditContentHTML error:', error);
    }
}