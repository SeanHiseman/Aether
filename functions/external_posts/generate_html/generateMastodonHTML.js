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
                out += `
                    <div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
                        <img src="${m.url}" alt="Mastodon media" />
                    </div>
                `;
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
        //Quoted post
        if (media?.quotedPost) {
            const qp = media.quotedPost;
            out += `
                <div class="content-block quoted-post" data-blockid="${crypto.randomUUID()}" data-align="left" style="border-left: 3px solid #6364ff; padding-left: 12px; margin: 12px 0; background: rgba(99, 100, 255, 0.05); border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        ${qp.author.avatar ? `<img src="${escapeHtml(qp.author.avatar)}" alt="${escapeHtml(qp.author.handle)}" style="width: 20px; height: 20px; border-radius: 50%;" />` : ''}
                        <span style="font-weight: 600;">${escapeHtml(qp.author.displayName || qp.author.handle)}</span>
                        <span style="color: #666;">@${escapeHtml(qp.author.handle)}</span>
                    </div>
                    ${qp.content ? `<div style="margin: 8px 0;">${qp.content}</div>` : ''}
                    ${qp.attachments && qp.attachments.length > 0 ? qp.attachments.map(att => {
                        if (att.type === 'video') {
                            return `
                                <div style="margin: 8px 0;">
                                    <video controls style="max-width: 100%; border-radius: 8px;">
                                        <source src="${escapeHtml(att.url)}" type="video/mp4" />
                                    </video>
                                </div>
                            `;
                        } else {
                            return `
                                <div style="margin: 8px 0;">
                                    <img src="${escapeHtml(att.url)}" alt="Quoted post media" style="max-width: 100%; border-radius: 8px;" />
                                </div>
                            `;
                        }
                    }).join('') : ''}
                    ${qp.card ? (() => {
                        const c = qp.card;
                        return `
                            <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" style="display: block; margin: 8px 0; padding: 8px; border: 1px solid #ccc; border-radius: 8px; text-decoration: none; color: inherit;">
                                ${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title || c.hostname)}" style="max-width: 100%; border-radius: 4px; margin-bottom: 4px;" />` : ''}
                                <div style="font-weight: 600;">${escapeHtml(c.title || c.hostname || c.url)}</div>
                                ${c.description ? `<div style="font-size: 0.9em; color: #666;">${escapeHtml(c.description)}</div>` : ''}
                                <div style="font-size: 0.8em; color: #999;">${escapeHtml(c.hostname)}</div>
                            </a>
                        `;
                    })() : ''}
                    ${qp.url ? `
                        <a href="${escapeHtml(qp.url)}" target="_blank" rel="noopener noreferrer" style="display: block; margin-top: 8px; font-size: 0.9em; color: #6364ff; text-decoration: none;">
                            View quoted post →
                        </a>
                    ` : ''}
                </div>
            `;
        }
        const result = out.trim();

        // Log warning if content is empty
        if (!result) {
            console.warn('[GenerateMastodonHTML] Generated empty HTML:', {
                hasHtmlContent: !!htmlContent,
                htmlContentLength: htmlContent?.length || 0,
                hasAttachments: !!(media?.attachments && media.attachments.length > 0),
                hasCard: !!media?.card,
                hasQuotedPost: !!media?.quotedPost
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