import crypto from 'crypto';
import { escapeHtml } from '../../escapeHtml.js';

export async function GenerateBlueskyHTML(textBody, media) {
	try {
		let html = '';
		if (textBody?.trim()) {
			html += `
				<div class="content-block text-block" data-blockid="${crypto.randomUUID()}">
					<p>${escapeHtml(textBody).replace(/\n/g, '<br>')}</p>
				</div>
			`;
		}
		//Handle new structured media format
		if (media && typeof media === 'object' && !Array.isArray(media)) {
			//Images
			if (media.images && Array.isArray(media.images)) {
				for (const img of media.images) {
					if (!img.url) continue;
					html += `
						<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
							<img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || 'Bluesky media')}" />
						</div>
					`;
				}
			}
			//Videos - show thumbnail with play indicator linking to original post
			if (media.videos && Array.isArray(media.videos)) {
				for (const vid of media.videos) {
					if (!vid.thumbnail) continue;
					html += `
						<div class="content-block media-block video-thumbnail" data-blockid="${crypto.randomUUID()}" data-align="center" style="position: relative; cursor: pointer;">
							<img src="${escapeHtml(vid.thumbnail)}" alt="Video thumbnail" />
							<div class="video-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
								<span style="color: white; font-size: 24px; margin-left: 4px;">▶</span>
							</div>
						</div>
					`;
				}
			}
			//External link card
			if (media.card && media.card.uri) {
				const card = media.card;
				let hostname = '';
				try {
					hostname = new URL(card.uri).hostname;
				} catch { hostname = card.uri; }
				html += `
					<div class="content-block link-preview" data-blockid="${crypto.randomUUID()}" data-align="center" data-trusted="false" data-embed-preview="true">
						<a href="${escapeHtml(card.uri)}" target="_blank" rel="noopener noreferrer">
							${card.thumb ? `<div class="preview-image"><img src="${escapeHtml(card.thumb)}" alt="${escapeHtml(card.title || hostname)}" /></div>` : ''}
							<div class="preview-meta">
								<h4>${escapeHtml(card.title || hostname)}</h4>
								${card.description ? `<p>${escapeHtml(card.description)}</p>` : ''}
								<span class="preview-host">${escapeHtml(hostname)}</span>
							</div>
						</a>
					</div>
				`;
			}
			//Quoted post
			if (media.quotedPost) {
				const qp = media.quotedPost;
				const postUrl = qp.uri ? `https://bsky.app/profile/${qp.author.handle}/post/${qp.uri.split('/').pop()}` : '#';
				html += `
					<div class="content-block quoted-post" data-blockid="${crypto.randomUUID()}" data-align="left" style="border-left: 3px solid #1d9bf0; padding-left: 12px; margin: 12px 0; background: rgba(29, 155, 240, 0.05); border-radius: 8px;">
						<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
							${qp.author.avatar ? `<img src="${escapeHtml(qp.author.avatar)}" alt="${escapeHtml(qp.author.handle)}" style="width: 20px; height: 20px; border-radius: 50%;" />` : ''}
							<a href="https://bsky.app/profile/${escapeHtml(qp.author.handle)}" target="_blank" rel="noopener noreferrer" style="font-weight: 600; color: inherit; text-decoration: none;">
								${escapeHtml(qp.author.displayName || qp.author.handle)}
							</a>
							<span style="color: #666;">@${escapeHtml(qp.author.handle)}</span>
						</div>
						${qp.text ? `<p style="margin: 8px 0; white-space: pre-wrap;">${escapeHtml(qp.text)}</p>` : ''}
						${qp.images && qp.images.length > 0 ? qp.images.map(img => `
							<div style="margin: 8px 0;">
								<img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || 'Quoted post image')}" style="max-width: 100%; border-radius: 8px;" />
							</div>
						`).join('') : ''}
						${qp.videos && qp.videos.length > 0 ? qp.videos.map(vid => `
							<div style="margin: 8px 0; position: relative;">
								<img src="${escapeHtml(vid.thumbnail)}" alt="Video thumbnail" style="max-width: 100%; border-radius: 8px;" />
								<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
									<span style="color: white; font-size: 16px; margin-left: 2px;">▶</span>
								</div>
							</div>
						`).join('') : ''}
						${qp.card && qp.card.uri ? (() => {
							let hostname = '';
							try { hostname = new URL(qp.card.uri).hostname; } catch { hostname = qp.card.uri; }
							return `
								<a href="${escapeHtml(qp.card.uri)}" target="_blank" rel="noopener noreferrer" style="display: block; margin: 8px 0; padding: 8px; border: 1px solid #ccc; border-radius: 8px; text-decoration: none; color: inherit;">
									${qp.card.thumb ? `<img src="${escapeHtml(qp.card.thumb)}" alt="${escapeHtml(qp.card.title || hostname)}" style="max-width: 100%; border-radius: 4px; margin-bottom: 4px;" />` : ''}
									<div style="font-weight: 600;">${escapeHtml(qp.card.title || hostname)}</div>
									${qp.card.description ? `<div style="font-size: 0.9em; color: #666;">${escapeHtml(qp.card.description)}</div>` : ''}
									<div style="font-size: 0.8em; color: #999;">${escapeHtml(hostname)}</div>
								</a>
							`;
						})() : ''}
						<a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener noreferrer" style="display: block; margin-top: 8px; font-size: 0.9em; color: #1d9bf0; text-decoration: none;">
							View quoted post →
						</a>
					</div>
				`;
			}
		}
		//Handle legacy array format for backwards compatibility
		else if (Array.isArray(media)) {
			for (const m of media) {
				if (!m.url && !m.thumbnail) continue;
				const isVideo = m.type === 'video' || m.url?.match(/\.(mp4|webm|mov|m4v)$/i) || m.url?.includes('.m3u8');
				if (isVideo && m.thumbnail) {
					//Show video thumbnail with play indicator
					html += `
						<div class="content-block media-block video-thumbnail" data-blockid="${crypto.randomUUID()}" data-align="center" style="position: relative; cursor: pointer;">
							<img src="${escapeHtml(m.thumbnail)}" alt="Video thumbnail" />
							<div class="video-play-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
								<span style="color: white; font-size: 24px; margin-left: 4px;">▶</span>
							</div>
						</div>
					`;
				} else if (!isVideo && m.url) {
					html += `
						<div class="content-block media-block" data-blockid="${crypto.randomUUID()}" data-align="center">
							<img src="${escapeHtml(m.url)}" alt="Bluesky media" />
						</div>
					`;
				}
			}
		}
		return html.trim();
	} catch (error) {
		console.error(new Date().toISOString(), 'generateBlueskyContentHTML error:', error);
		return '';
	}
}