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
			//Quoted post is rendered by the frontend ExternalPostWidget component
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
		const result = html.trim();
		// Log warning if content is empty
		if (!result) {
			console.warn('[GenerateBlueskyHTML] Generated empty HTML:', {
				hasTextBody: !!textBody,
				textBodyLength: textBody?.length || 0,
				hasMedia: !!media,
				mediaType: Array.isArray(media) ? 'array' : typeof media
			});
		}
		return result;
	} catch (error) {
		console.error('[GenerateBlueskyHTML] Error generating HTML:', {
			error: error.message,
			stack: error.stack,
			textBodyLength: textBody?.length || 0,
			hasMedia: !!media
		});
		return '';
	}
}