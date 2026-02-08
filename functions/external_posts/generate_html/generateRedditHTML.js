import crypto from 'crypto';
import { escapeHtml } from '../../escapeHtml.js';

export async function GenerateRedditHTML(textBody, media) {
    try {
        let html = '';

        // Handle text body
        if (textBody && textBody.trim()) {
            html += `
                <div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
                    <p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }

        // Handle link posts (external URLs)
        if (media?.link?.url) {
            const link = media.link;
            try {
                const hostname = new URL(link.url).hostname;
                html += `
                    <div class="content-block link-preview" data-blockid="${crypto.randomUUID()}" data-align="center" data-trusted="false" data-embed-preview="true">
                        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                            ${link.thumbnail ? `<div class="preview-image"><img src="${escapeHtml(link.thumbnail)}" alt="Link preview" /></div>` : ''}
                            <div class="preview-meta">
                                <span class="preview-host">${escapeHtml(hostname)}</span>
                            </div>
                        </a>
                    </div>
                `;
            } catch (urlError) {
                console.error('[GenerateRedditHTML] Error processing link URL:', {
                    url: link.url,
                    error: urlError.message
                });
            }
        }

        // Handle image/gallery posts
        const mediaItems = Array.isArray(media) ? media : [];
        for (const item of mediaItems) {
            const url = item?.source?.url?.replace(/&amp;/g, '&');
            if (!url) continue;
            html += `
                <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                    <img src="${url}" alt="Reddit media" />
                </div>
            `;
        }
        const result = html.trim();

        // Log warning if content is empty
        if (!result) {
            console.warn('[GenerateRedditHTML] Generated empty HTML:', {
                hasTextBody: !!textBody,
                textBodyLength: textBody?.length || 0,
                hasMedia: !!media,
                mediaType: media?.link ? 'link' : Array.isArray(media) ? 'array' : typeof media
            });
        }

        return result;
    } catch (error) {
        console.error('[GenerateRedditHTML] Error generating HTML:', {
            error: error.message,
            stack: error.stack,
            textBodyLength: textBody?.length || 0,
            hasMedia: !!media
        });
        return '';
    }
}