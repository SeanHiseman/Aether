import crypto from 'crypto';
import { escapeHtml } from '../../escapeHtml.js';

//Mastodon posts use html, not raw text
//Mastodon attachment types: image, video, gifv, audio, unknown
export async function GenerateMastodonHTML(htmlContent, media) {
    try {
        let out = '';
        if (htmlContent && htmlContent.trim()) {
            out += `
                <div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
                    ${htmlContent}
                </div>
            `;
        }
        if (media?.attachments && Array.isArray(media.attachments)) {
            for (const m of media.attachments) {
                if (!m.url) continue;
                switch (m.type) {
                    case 'gifv':
                        //GIFs on Mastodon are MP4s that should autoplay and loop
                        out += `
                            <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                                <video autoplay loop muted playsinline style="max-width: 100%;">
                                    <source src="${escapeHtml(m.url)}" type="video/mp4" />
                                </video>
                            </div>
                        `;
                        break;
                    case 'video':
                        out += `
                            <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                                <video controls playsinline style="max-width: 100%;">
                                    <source src="${escapeHtml(m.url)}" />
                                </video>
                            </div>
                        `;
                        break;
                    case 'audio':
                        out += `
                            <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                                <audio controls style="width: 100%;">
                                    <source src="${escapeHtml(m.url)}" />
                                </audio>
                            </div>
                        `;
                        break;
                    case 'image':
                    default:
                        //Treat image and unknown types as images — if URL is a video format, render as video
                        if (/\.(mp4|webm|mov|m4v|gifv)(\?|$)/i.test(m.url)) {
                            out += `
                                <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                                    <video controls playsinline style="max-width: 100%;">
                                        <source src="${escapeHtml(m.url)}" />
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
                        break;
                }
            }
        }
        //Create card (link preview)
        if (media?.card && media.card.url) {
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
            }
        }
        //Quoted post is rendered by the frontend ExternalPostWidget component
        const result = out.trim();
        if (!result) {
            console.warn('[GenerateMastodonHTML] Generated empty HTML:', {
                htmlContent: htmlContent?.substring(0, 200),
                attachmentCount: media?.attachments?.length || 0,
                attachmentTypes: media?.attachments?.map(a => a.type) || [],
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
