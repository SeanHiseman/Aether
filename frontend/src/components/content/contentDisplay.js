import AppBlock from './appBlock'
import AppWebContainer from './appWebContainer'
import ContentWidget from './contentWidget'
import ExternalPostWidget from '../../socialConnect/externalPostWidget'
import { useEffect, useRef, useState } from 'react'

const ContentDisplay = ({ post, isAuthenticated = false, isFullscreen = false, onCodeAppChange = () => {}, onHeightChange = () => {}, onOverflowChange = () => {}, redirect = true, showFullContent = false, showScrollBar = true }) => {
	//console.log("post:", post);
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
			const viewportHeight = window.innerHeight * (isMobile ? (isAuthenticated ? 0.60 : 0.55) : 0.7); //60vh for mobile users because of feed header, 55vh because of footer
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
	}, [blocks, isMobile, onHeightChange, onOverflowChange])

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
		<>
			<div
				ref={contentRef}
				className="display-container"
				style={{
					maxHeight: (showFullContent || isFullscreen) ? 'none' : (isMobile ? (isAuthenticated ? '60vh' : '55vh') : '70vh'),
					height: isFullscreen ? '100%' : 'auto',
					overflow: showScrollBar ? 'auto' : 'hidden',
					position: 'relative',
					borderTopLeftRadius: post?.title ? '0' : undefined,
					borderTopRightRadius: post?.title ? '0' : undefined
				}}
			>
				{blocks.map((block, i) => {
					if (block?.type === 'text') {
						return (
							<div dangerouslySetInnerHTML={{ __html: block?.html }} key={i} onClick={redirect && !post?.is_external ? handleRedirect : null} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 5, paddingRight: 5 }} />
						);
					}
					if (block?.type === 'code') {
						return (
							<div key={i} data-iframe-wrapper style={{ position: 'relative', width: '100%', height: isFullscreen ? '100%' : (isMobile ? (isAuthenticated ? '60vh' : '55vh') : '70vh') }}>
								<iframe
									sandbox={"allow-scripts allow-downloads allow-popups allow-modals"}
									srcDoc={block?.code}
									style={{ border: 'none', height: '100%', width: '100%', pointerEvents: 'auto' }}
									title={`code-block-${block?.id}`}
								/>
							</div>
						)
					}
					if (block?.type === 'link') {
						return (
							<div key={i} className="link-preview-block">
								<a href={block?.href} target="_blank" rel="noopener noreferrer" className="link-preview-card">
									{block?.image && (
										<div className="link-preview-image">
											<img src={block?.image} alt={block?.title || ''} />
										</div>
									)}
									<div className="link-preview-content">
										{block?.title && (
											<h4 className="link-preview-title">
												{block?.title}
											</h4>
										)}
										{block?.description && (
											<p className="link-preview-description">
												{block?.description}
											</p>
										)}
										<span className="link-preview-host">
											{block?.host}
										</span>
									</div>
								</a>
							</div>
						);
					}
					if (block?.type === 'media') {
						const styleObj =
							block?.align === 'center'
								? { display: 'block', height: 'auto', margin: '0 auto', maxWidth: '100%', maxHeight: (isAuthenticated ? '60vh' : '55vh'), cursor: 'pointer' }
								: { height: 'auto', maxWidth: '100%', maxHeight: (isAuthenticated ? (isAuthenticated ? '60vh' : '55vh') : '55vh'), cursor: 'pointer' };
						if (block?.isImage) return <img alt="Uploaded Media" key={i} src={block?.url} style={styleObj} onClick={!post?.is_external ? handleRedirect : null} />;
						if (block?.isVideo) {
							return (
								<video controls key={i} style={styleObj}>
									<source src={block?.url} type={block?.fileType || 'video/*'} />
								</video>
							);
						}
						return <div key={i}>Unsupported</div>;
					}
					if (block?.type === 'app') {
						return block.kind === 'webcontainer'
							? <AppWebContainer key={block?.id} buildId={block?.buildId}/>
							: <AppBlock key={block?.id} appPath={block?.appPath}/>
					}
					if (block?.type === 'quoted') {
						return (
							<div
								key={i}
								dangerouslySetInnerHTML={{ __html: block?.html }}
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
			</div>
			{quotedPostData && (
				<div style={{ marginLeft: '20px', marginTop: '12px', marginBottom: '12px' }}>
					<ContentWidget
						post={quotedPostData}
						readOnly={false}
						display={false}
						sharedPost={false}
						isQuoted={true}
						showAsParent={true}
					/>
				</div>
			)}
			{quotedExternalPostData && !post?.is_external && (
				<div style={{ marginLeft: '20px', marginTop: '12px', marginBottom: '12px' }}>
					<ExternalPostWidget
						post={quotedExternalPostData}
						sharedPost={false}
						isQuoted={true}
					/>
				</div>
			)}
		</>
	)
}

export default ContentDisplay;