import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import AppBlock from './appBlock'
import AppWebContainer from './appWebContainer'

const ContentDisplay = ({ post, isFullscreen = false, onCodeAppChange = () => {}, onHeightChange = () => {}, onOverflowChange = () => {}, redirect = true, showFullContent = false, showScrollBar = true }) => {
	const [blocks, setBlocks] = useState([]);
	const content = post?.content;
	const contentRef = useRef(null);
	const [loading, setLoading] = useState(false);
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
				const response = await fetch(content);
				const htmlText = await response.text();
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
							isTrustedEmbed: div.getAttribute('data-trusted') === 'true' //read trust flag from backend
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
			const viewportHeight = window.innerHeight * 0.7; //70vh
			let isOverflowing = scrollHeight > viewportHeight;
			if (singleFixed && scrollHeight <= viewportHeight) {
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
		<div ref={contentRef} className="display-container" style={{ 
			maxHeight: (showFullContent || isFullscreen) ? 'none' : '70vh',
			height: isFullscreen ? '100%' : 'auto',
			overflow: showScrollBar ? 'auto' : 'hidden', 
			position: 'relative', 
			borderTopRightRadius: post?.title && '0', 
			borderTopLeftRadius: post?.title && '0' 
		}}>
			{blocks.map((block, i) => {
				if (block.type === 'text') {
					return (
						<div dangerouslySetInnerHTML={{ __html: block.html }} key={i} onClick={redirect ? handleRedirect : null} style={{ cursor: 'pointer', paddingTop: 5, paddingLeft: 5, paddingRight: 5 }} />
					);
				}
				if (block.type === 'code') {
					return (
						<div
							key={i}
							style={{ position: 'relative', width: '100%', height: isFullscreen ? '100%' : '70vh' }}
							onClick={isFullscreen ? null : e => {
								const iframe = e.currentTarget.querySelector('iframe');
								if (iframe) iframe.style.pointerEvents = 'auto';
							}}
							onMouseLeave={isFullscreen ? null : e => {
								const iframe = e.currentTarget.querySelector('iframe');
								if (iframe) iframe.style.pointerEvents = 'none';
							}}
						>
							<iframe
								sandbox={
									block.isTrustedEmbed
										? "allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals"
										: "allow-scripts allow-downloads allow-popups allow-forms allow-modals"
								}
								srcDoc={block.code}
								style={{
									border: 'none',
									height: '100%',
									width: '100%',
									pointerEvents: isFullscreen ? 'auto' : 'none',
								}}
								title={`code-block-${block.id}`}
							/>
						</div>
					)
				}
				if (block.type === 'media') {
					const styleObj =
						block.align === 'center'
							? { display: 'block', height: 'auto', margin: '0 auto', maxWidth: '100%', maxHeight: '60vh', cursor: 'pointer' }
							: { height: 'auto', maxWidth: '100%', maxHeight: '60vh', cursor: 'pointer' };
					if (block.isImage) return <img alt="Uploaded Media" key={i} src={block.url} style={styleObj} onClick={handleRedirect} />;
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
				return null
			})}
		</div>
	)
}

ContentDisplay.propTypes = {
	content: PropTypes.string,
	isFullscreen: PropTypes.bool,
	onCodeAppChange: PropTypes.func,
	onHeightChange: PropTypes.func,
	onOverflowChange: PropTypes.func,
	showFullContent: PropTypes.bool,
	showScrollBar: PropTypes.bool,
}

export default ContentDisplay;