import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import AppBlock from './appBlock'
import AppWebContainer from './appWebContainer'

const ContentDisplay = ({ content, onOverflowChange = () => {}, showFullContent, showScrollBar }) => {
	const [blocks, setBlocks] = useState([])
	const contentRef = useRef(null)
	const iframeRefs = useRef({})
	const maxHeightStyle = showFullContent ? 'none' : '50vh'
	const overflowStyle = 'visible'

	useEffect(() => {
		const parser = new DOMParser()
		const doc    = parser.parseFromString(content || '', 'text/html')
		const divs   = doc.querySelectorAll('.content-block')
		const parsed = []

		divs.forEach(div => {
			const id = div.getAttribute('data-blockid')
			if (div.classList.contains('text-block')) {
				parsed.push({
					id,
					type: 'text',
					html: div.innerHTML.trim()
				})
			}
			else if (div.classList.contains('code-block')) {
				parsed.push({
					id,
					type: 'code',
					code: div.getAttribute('data-code') || ''
				})
			}
			else if (div.classList.contains('media-block')) {
				const align = div.getAttribute('data-align') || 'left'
				const img   = div.querySelector('img')
				const video = div.querySelector('video')
				if (img) {
					parsed.push({
						id,
						type: 'media',
						isImage: true,
						isVideo: false,
						align,
						url: img.src
					})
				} else if (video) {
					const src = video.querySelector('source')
					parsed.push({
						id,
						type: 'media',
						isImage: false,
						isVideo: true,
						align,
						fileType: src?.type || '',
						url: src?.src || ''
					})
				}
			}
			else if (div.classList.contains('app-block')) {
				parsed.push({
					id,
					type: 'app',
					appPath: div.getAttribute('data-apppath'),
					buildId: div.getAttribute('data-buildid'),
					kind:    div.getAttribute('data-kind') || 'static'
				})
			}
		})

		setBlocks(parsed)
	}, [content])

	useEffect(() => {
		function handleMessage(e) {
			if (!e.data || !e.data.blockId || !e.data.height) return
			const iframe = iframeRefs.current[e.data.blockId]
			if (iframe) {
				iframe.style.height = `${e.data.height}px`
				debounceCheckOverflow()
			}
		}
		window.addEventListener('message', handleMessage)
		return () => window.removeEventListener('message', handleMessage)
	}, [])

	useEffect(() => {
		debounceCheckOverflow()
	}, [blocks])

	useEffect(() => {
		const observer = new ResizeObserver(debounceCheckOverflow)
		if (contentRef.current) observer.observe(contentRef.current)
		return () => {
			if (contentRef.current) observer.unobserve(contentRef.current)
			observer.disconnect()
		}
	}, [blocks])

	const debounce = (func, delay) => {
		let timer
		return () => {
			clearTimeout(timer)
			timer = setTimeout(func, delay)
		}
	}

	const checkOverflow = () => {
		if (!contentRef.current) return
		const currentHeight = contentRef.current.scrollHeight
		const maxAllowed = window.innerHeight * 0.5
		onOverflowChange(currentHeight > maxAllowed)
	}

	const debounceCheckOverflow = debounce(checkOverflow, 100)

	return (
		<div
			ref={contentRef}
			style={{
				maxHeight: maxHeightStyle,
				overflow: overflowStyle,
				transition: 'max-height 0.3s ease',
			}}
		>
			{blocks.map((block, i) => {
				if (block.type === 'text') {
					return <div dangerouslySetInnerHTML={{ __html: block.html }} key={i} />
				}
				if (block.type === 'code') {
					return (
						<iframe
							key={i}
							ref={el => {
								iframeRefs.current[block.id] = el
							}}
							sandbox="allow-scripts allow-same-origin"
							srcDoc={`<!DOCTYPE html><html><head><style>body{margin:0;padding:0}</style></head><body>${block.code}<script>function h(){const d=document.body.scrollHeight;parent.postMessage({blockId:'${block.id}',height:d},'*')}window.addEventListener('load',h);window.addEventListener('resize',h);new MutationObserver(h).observe(document.body,{childList:true,subtree:true,characterData:true})<\/script></body></html>`}
							style={{ border: 'none', height: '0px', width: '100%' }}
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
						: <AppBlock      key={block.id} appPath={block.appPath}/>
				}
				return null
			})}
		</div>
	)
}

ContentDisplay.propTypes = {
	content: PropTypes.string.isRequired,
	onOverflowChange: PropTypes.func,
	showFullContent: PropTypes.bool.isRequired,
	showScrollBar: PropTypes.bool.isRequired,
}

export default ContentDisplay