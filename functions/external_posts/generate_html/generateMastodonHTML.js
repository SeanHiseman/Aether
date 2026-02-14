import crypto from 'crypto';
import { escapeHtml } from '../../escapeHtml.js';

//Mastodon posts use html, not raw text
export async function GenerateMastodonHTML(htmlContent, media) {
    try {
        let out = '';
        if (htmlContent) {
            out += `
                <div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
                    ${htmlContent}
                </div>
            `;
        }
        if (media?.attachments && Array.isArray(media.attachments)) {
            for (const m of media.attachments) {
                if (!m.url) continue;
                if (m.type === 'gifv') {
                    //GIFs on Mastodon are MP4s that should autoplay and loop
                    out += `
                        <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                            <video autoplay loop muted playsinline style="max-width: 100%;">
                                <source src="${escapeHtml(m.url)}" type="video/mp4" />
                            </video>
                        </div>
                    `;
                } else if (m.type === 'video') {
                    out += `
                        <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                            <video controls playsinline style="max-width: 100%;">
                                <source src="${escapeHtml(m.url)}" type="video/mp4" />
                            </video>
                        </div>
                    `;
                } else {
                    out += `
                        <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                            <img src="${escapeHtml(m.url)}" alt="Mastodon media" />
                        </div>
                    `;
                }
            }
        }
        //Create card (link preview)
        if (media?.card) {
            const card = media.card;
            try {
                const hostname = card.hostname || new URL(card.url).hostname;
                out += `
                    <div class="content-block link-preview" data-blockid="${crypto.randomUUID()}" data-align="center" data-trusted="false" data-embed-preview="true">
                        <a href="${escapeHtml(card.url)}" target="_blank" rel="noopener noreferrer">
                            ${card.image ? `<div class="preview-image"><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.title || hostname)}" /></div>` : ''}
                            <div class="preview-meta">
                                <h4>${escapeHtml(card.title || hostname || card.url)}</h4>
                                ${card.description ? `<p>${escapeHtml(card.description)}</p>` : ''}
                                <span class="preview-host">${escapeHtml(hostname)}</span>
                            </div>
                        </a>
                    </div>
                `;
            } catch (urlError) {
                console.error('[GenerateMastodonHTML] Error processing card URL:', {
                    url: card.url,
                    error: urlError.message
                });
                // Skip card if URL is invalid
            }
        }
        //Quoted post is rendered by the frontend ExternalPostWidget component
        const result = out.trim();

        // Log warning if content is empty
        if (!result) {
            console.warn('[GenerateMastodonHTML] Generated empty HTML:', {
                hasHtmlContent: !!htmlContent,
                htmlContentLength: htmlContent?.length || 0,
                hasAttachments: !!(media?.attachments && media.attachments.length > 0),
                hasCard: !!media?.card
            });
        }

        return result;
    } catch (error) {
        console.error('[GenerateMastodonHTML] Error generating HTML:', {
            error: error.message,
            stack: error.stack,
            htmlContentLength: htmlContent?.length || 0,
            hasMedia: !!media
        });
        return '';
    }
}