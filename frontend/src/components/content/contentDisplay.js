import AppBlock from './appBlock'
import AppWebContainer from './appWebContainer'
import { useEffect, useRef, useState } from 'react'

const ContentDisplay = ({ post, isFullscreen = false, onCodeAppChange = () => {}, onHeightChange = () => {}, onOverflowChange = () => {}, redirect = true, showFullContent = false, showScrollBar = true }) => {
	//console.log("post:", post);
	const [activeIframeId, setActiveIframeId] = useState(null);
	const [blocks, setBlocks] = useState([]);
	const content = post?.content;
	const contentRef = useRef(null);
	const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
	const [loading, setLoading] = useState(false);
	const quotedPostData = post?.quotedPost || null;
	const quotedExternalPostData = post?.quotedExternalPost || null;
	const urlPrefix = post?.parentChannel?.feed?.is_group ? 'g' : 'u';

	//Prevents redirect when already viewing the individual post
	const handleRedirect = () => {
		if (window.location.pathname.includes(`/${post?.post_id}`)) return;
		window.location.href = `/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/${post?.post_id}`;
	};

	useEffect(() => {
		if (!content) return;
		const fetchHtml = async () => {
			setLoading(true);
			try {
				let htmlText;
				const isUrl = content.startsWith('http') || content.startsWith('/');
				if (content.startsWith('data:text/html') || isUrl) {
					//Fetch data 
					const response = await fetch(content);
					htmlText = await response.text();
				} else {
					//Use raw html
					htmlText = content;
				}
				const parser = new DOMParser();
				const doc = parser.parseFromString(htmlText, 'text/html');
				const divs = doc.querySelectorAll('.content-block');
				const parsed = [];
				divs.forEach(div => {
					const id = div.getAttribute('data-blockid');
					if (div.classList.contains('text-block')) {
						parsed.push({
							html: div.innerHTML.trim(),
							id,
							type: 'text',
						});
					} else if (div.classList.contains('code-block')) {
						parsed.push({
							code: div.getAttribute('data-code') || div.innerHTML.trim(),
							id,
							type: 'code',
						});
					} else if (div.classList.contains('media-block')) {
						const align = div.getAttribute('data-align') || 'left';
						const img = div.querySelector('img');
						const video = div.querySelector('video');
						if (img) {
							parsed.push({
								align,
								id,
								isImage: true,
								isVideo: false,
								type: 'media',
								url: img.src,
							});
						} else if (video) {
							const src = video.querySelector('source');
							parsed.push({
								align,
								fileType: src?.type || '',
								id,
								isImage: false,
								isVideo: true,
								type: 'media',
								url: src?.src || '',
							});
						}
					} else if (div.classList.contains('link-preview')) {
						const anchor = div.querySelector('a');
						const href = anchor?.href || '';
						const host = div.querySelector('.preview-host')?.textContent?.trim() || '';
						const image = div.querySelector('.preview-image img')?.src || '';
						const title = div.querySelector('.preview-meta h4')?.textContent?.trim() || '';
						const description = div.querySelector('.preview-meta p')?.textContent?.trim() || '';
						const isEmbedPreview = div.getAttribute('data-embed-preview') === 'true';
						parsed.push({
							description,
							href,
							host,
							id,
							image,
							isEmbedPreview,
							title,
							type: 'link',
						});
					} else if (div.classList.contains('quoted-post')) {
						parsed.push({
							html: div.innerHTML.trim(),
							id,
							type: 'quoted',
						});
					} else if (div.classList.contains('app-block')) {
						parsed.push({
							appPath: div.getAttribute('data-apppath'),
							buildId: div.getAttribute('data-buildid'),
							id,
							kind: div.getAttribute('data-kind') || 'static',
							type: 'app',
						});
					}
				});
				setBlocks(parsed);
			} catch (error) {
				setBlocks([]);
			} finally {
				setLoading(false);
			}
		};
		fetchHtml();
	}, [content]);

	//Find element height for use in determining what height to set content
	useEffect(() => {
		const element = contentRef.current
		if (!element) return
		const fixed = blocks.some(b => b.type === 'code' || b.type === 'app')
		const singleFixed = blocks.length === 1 && fixed
		const update = () => {
			const scrollHeight = element.scrollHeight;
			const viewportHeight = window.innerHeight * 0.7; // 70vh (collapsed height)
			const threshold = 5;
			//Check if content would overflow when collapsed
			let isOverflowing = scrollHeight > viewportHeight + threshold;
			if (singleFixed) {
				isOverflowing = false;
			}
			onOverflowChange(isOverflowing);
			onHeightChange(scrollHeight);
		}
		update()
		const ro = new ResizeObserver(update)
		ro.observe(element)
		window.addEventListener('resize', update)
		return () => {
			ro.disconnect()
			window.removeEventListener('resize', update)
		}
	}, [blocks, onHeightChange, onOverflowChange])

	//Detect if there is any code or app blocks to toggle fullscreen button
	useEffect(() => {
		onCodeAppChange(blocks.some(b => b.type === 'app' || b.type === 'code'))
	}, [blocks, onCodeAppChange])

	if (loading) {
		return <p className="small-text faded-text">Loading content…</p>;
	}
	if (!content) {
		return <p className="small-text faded-text">Content not found</p>
	}
	return (
		<div
			ref={contentRef}
			className="display-container"
			style={{
				maxHeight: (showFullContent || isFullscreen) ? 'none' : '70vh',
				height: isFullscreen ? '100%' : 'auto',
				overflow: showScrollBar ? 'auto' : 'hidden',
				position: 'relative',
				borderTopLeftRadius: post?.title ? '0' : undefined,
				borderTopRightRadius: post?.title ? '0' : undefined
			}}
		>
			{blocks.map((block, i) => {
				if (block.type === 'text') {
					return (
						<div dangerouslySetInnerHTML={{ __html: block.html }} key={i} onClick={redirect && !post?.is_external ? handleRedirect : null} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 5, paddingRight: 5 }} />
					);
				}
				if (block.type === 'code') {
					const iframeId = `iframe-${block.id || i}`;
					const isActive = isFullscreen || activeIframeId === iframeId;
					return (
						<div
							key={i}
							data-iframe-wrapper
							style={{ position: 'relative', width: '100%', height: isFullscreen ? '100%' : '70vh' }}
							onClick={isFullscreen ? null : () => setActiveIframeId(iframeId)}
							onMouseLeave={isFullscreen ? null : () => setActiveIframeId(null)}
						>
							<iframe
								sandbox={"allow-scripts allow-downloads allow-popups allow-modals"}
								srcDoc={block.code}
								style={{ border: 'none', height: '100%', width: '100%', pointerEvents: isActive ? 'auto' : 'none' }}
								title={`code-block-${block.id}`}
							/>
							{!isActive && (
								<div style={{
									background: 'var(--darkest)',
									borderRadius: 6,
									bottom: 8,
									color: 'white',
									fontSize: 12,
									position: 'absolute',
									padding: '6px 12px',
									pointerEvents: 'none',
									right: 8,
								}}>
									{isMobile ? 'Tap' : 'Click'} to interact
								</div>
							)}
						</div>
					)
				}
				if (block.type === 'link') {
					return (
						<div key={i} className="link-preview-block">
							<a href={block.href} target="_blank" rel="noopener noreferrer" className="link-preview-card">
								{block.image && (
									<div className="link-preview-image">
										<img src={block.image} alt={block.title || ''} />
									</div>
								)}
								<div className="link-preview-content">
									{block.title && (
										<h4 className="link-preview-title">
											{block.title}
										</h4>
									)}
									{block.description && (
										<p className="link-preview-description">
											{block.description}
										</p>
									)}
									<span className="link-preview-host">
										{block.host}
									</span>
								</div>
							</a>
						</div>
					);
				}
				if (block.type === 'media') {
					const styleObj =
						block.align === 'center'
							? { display: 'block', height: 'auto', margin: '0 auto', maxWidth: '100%', maxHeight: '60vh', cursor: 'pointer' }
							: { height: 'auto', maxWidth: '100%', maxHeight: '60vh', cursor: 'pointer' };
					if (block.isImage) return <img alt="Uploaded Media" key={i} src={block.url} style={styleObj} onClick={!post?.is_external ? handleRedirect : null} />;
					if (block.isVideo) {
						return (
							<video controls key={i} style={styleObj}>
								<source src={block.url} type={block.fileType || 'video/*'} />
							</video>
						);
					}
					return <div key={i}>Unsupported</div>;
				}
				if (block.type === 'app') {
					return block.kind === 'webcontainer'
						? <AppWebContainer key={block.id} buildId={block.buildId}/>
						: <AppBlock key={block.id} appPath={block.appPath}/>
				}
				if (block.type === 'quoted') {
					return (
						<div
							key={i}
							dangerouslySetInnerHTML={{ __html: block.html }}
							style={{
								borderLeft: '3px solid #1d9bf0',
								paddingLeft: '12px',
								margin: '12px 5px',
								background: 'rgba(29, 155, 240, 0.05)',
								borderRadius: '8px',
								padding: '12px'
							}}
						/>
					);
				}
				return null
			})}
			{quotedPostData && (
				<div
					style={{
						borderLeft: '3px solid #6b46c1',
						paddingLeft: '12px',
						margin: '12px 5px',
						background: 'rgba(107, 70, 193, 0.05)',
						borderRadius: '8px',
						padding: '12px',
						cursor: 'pointer'
					}}
					onClick={() => {
						const qUrlPrefix = quotedPostData?.parentChannel?.feed?.is_group ? 'g' : 'u';
						window.location.href = `/${qUrlPrefix}/${quotedPostData?.parentChannel?.feed?.feed_name}/${quotedPostData?.parentChannel?.channel_name}/${quotedPostData?.post_id}`;
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
						{quotedPostData?.poster?.feed_photo && (
							<img src={quotedPostData.poster.feed_photo} alt={quotedPostData.poster.feed_name} className="tiny-feed-photo" onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} />
						)}
						<span style={{ fontWeight: 600, fontSize: '14px' }}>
							{quotedPostData?.poster?.feed_name || 'Anonymous'}
						</span>
					</div>
					{quotedPostData?.title && (
						<p style={{ fontWeight: 600, margin: '8px 0', fontSize: '14px' }}>
							{quotedPostData.title}
						</p>
					)}
					{quotedPostData?.text_body && (
						<p style={{ margin: '8px 0', fontSize: '13px', color: '#666' }}>
							{quotedPostData.text_body.substring(0, 600)}
							{quotedPostData.text_body.length > 600 ? '...' : ''}
						</p>
					)}
					<span style={{ fontSize: '12px', color: '#1d9bf0', display: 'block', marginTop: '8px' }}>
						View quoted post →
					</span>
				</div>
			)}
		{quotedExternalPostData && (
			<div
				style={{
					borderLeft: '3px solid #e67e22',
					paddingLeft: '12px',
					margin: '12px 5px',
					background: 'rgba(230, 126, 34, 0.05)',
					borderRadius: '8px',
					padding: '12px',
					cursor: 'pointer'
				}}
				onClick={() => {
					if (quotedExternalPostData?.url) {
						window.open(quotedExternalPostData.url, '_blank');
					}
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
					{quotedExternalPostData?.author_photo && (
						<img
							src={quotedExternalPostData.author_photo}
							alt={quotedExternalPostData.author}
							style={{ width: '20px', height: '20px', borderRadius: '50%' }}
							onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
						/>
					)}
					<span style={{ fontWeight: 600, fontSize: '14px' }}>
						{quotedExternalPostData?.author || 'Anonymous'}
					</span>
					<span style={{ fontSize: '12px', color: '#666' }}>
						• {quotedExternalPostData?.source}
					</span>
				</div>
				{quotedExternalPostData?.title && (
					<p style={{ fontWeight: 600, margin: '8px 0', fontSize: '14px' }}>
						{quotedExternalPostData.title}
					</p>
				)}
				{quotedExternalPostData?.text_body && (
					<p style={{ margin: '8px 0', fontSize: '13px', color: '#666' }}>
						{quotedExternalPostData.text_body.substring(0, 600)}
						{quotedExternalPostData.text_body.length > 600 ? '...' : ''}
					</p>
				)}
				<span style={{ fontSize: '12px', color: '#e67e22', display: 'block', marginTop: '8px' }}>
					View external post →
				</span>
			</div>
		)}
		</div>
	)
}

export default ContentDisplay;