import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import AppBlock from './appBlock'
import AppWebContainer from './appWebContainer'

const ContentDisplay = ({ content, onCodeAppChange = () => {}, onOverflowChange = () => {}, showFullContent = false, showScrollBar = true }) => {
	const [blocks, setBlocks] = useState([])
	const contentRef = useRef(null)
	const heightStyle = showFullContent ? 'auto' : '100%'

	useEffect(() => {
		const parser = new DOMParser()
		const doc = parser.parseFromString(content || '', 'text/html')
		const divs = doc.querySelectorAll('.content-block')
		const parsed = []
		divs.forEach(div => {
			const id = div.getAttribute('data-blockid')
			if (div.classList.contains('text-block')) {
				parsed.push({
					html: div.innerHTML.trim(),
					id,
					type: 'text',
				})
			} else if (div.classList.contains('code-block')) {
				parsed.push({
					code: div.getAttribute('data-code') || '',
					id,
					type: 'code',
				})
			} else if (div.classList.contains('media-block')) {
				const align = div.getAttribute('data-align') || 'left'
				const img = div.querySelector('img')
				const video = div.querySelector('video')
				if (img) {
					parsed.push({
						align,
						id,
						isImage: true,
						isVideo: false,
						type: 'media',
						url: img.src,
					})
				} else if (video) {
					const src = video.querySelector('source')
					parsed.push({
						align,
						fileType: src?.type || '',
						id,
						isImage: false,
						isVideo: true,
						type: 'media',
						url: src?.src || '',
					})
				}
			} else if (div.classList.contains('app-block')) {
				parsed.push({
					appPath: div.getAttribute('data-apppath'),
					buildId: div.getAttribute('data-buildid'),
					id,
					kind: div.getAttribute('data-kind') || 'static',
					type: 'app',
				})
			}
		})

		setBlocks(parsed)
	}, [content])

	//Find element height for use in determining what height to set content
	useEffect(() => {
		const element = contentRef.current
		if (!element) return
		const fixed = blocks.some(b => b.type === 'code' || b.type === 'app')
		const update = () => onOverflowChange(fixed || element.scrollHeight > element.clientHeight)
		update()
		const ro = new ResizeObserver(update)
		ro.observe(element)
		window.addEventListener('resize', update)
		return () => {
			ro.disconnect()
			window.removeEventListener('resize', update)
		}
	}, [blocks, onOverflowChange])

	//Detect if there is any code or app blocks to toggle fullscreen button
	useEffect(() => {
		onCodeAppChange(blocks.some(b => b.type === 'app' || b.type === 'code'))
	}, [blocks, onCodeAppChange])

	if (!content) {
		return <p className="small-text faded-text">Content not found</p>
	}

	return (
		<div ref={contentRef} className="display-container" style={{ height: heightStyle, overflow: showScrollBar ? 'auto' : 'hidden', position: 'relative' }}>
			{blocks.map((block, i) => {
				if (block.type === 'text') {
					return <div dangerouslySetInnerHTML={{ __html: block.html }} key={i} style={{ paddingTop: 5, paddingLeft: 5, paddingRight: 5 }} />
				}
				if (block.type === 'code') {
					return (
						<iframe
							key={i}
							sandbox="allow-scripts allow-same-origin"
							srcDoc={block.code}
							style={{ border: 'none', height: '100%', width: '100%' }}
							title={`code-block-${block.id}`}
						/>
					)
				}
				if (block.type === 'media') {
					const styleObj =
						block.align === 'center'
							? { display: 'block', height: 'auto', margin: '0 auto', maxWidth: '100%' }
							: { height: 'auto', maxWidth: '100%' }
					if (block.isImage) return <img alt="Uploaded Media" key={i} src={block.url} style={styleObj} />
					if (block.isVideo) {
						return (
							<video controls key={i} style={styleObj}>
								<source src={block.url} type={block.fileType || 'video/*'} />
							</video>
						)
					}
					return <div key={i}>Unsupported</div>
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
	onCodeAppChange: PropTypes.func,
	onOverflowChange: PropTypes.func,
	showFullContent: PropTypes.bool,
	showScrollBar: PropTypes.bool,
}

export default ContentDisplay;