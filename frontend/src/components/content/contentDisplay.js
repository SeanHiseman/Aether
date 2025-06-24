import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'

const AppBlock = ({ buildId }) => {
	const iframeRef = useRef(null)
	const MIN_HEIGHT = 300
	const onLoad = e => {
		try {
			const doc = e.target.contentWindow.document
			const h = Math.max(doc.body.scrollHeight, MIN_HEIGHT)
			e.target.style.height = `${h}px`
		} catch {}
	}
	return (
		<iframe
			key={buildId}
			ref={iframeRef}
			sandbox="allow-scripts allow-same-origin"
			src={`/app_builds/${buildId}/index.html`}
			style={{ border: 'none', minHeight: '50vh', width: '100%', height: '50vh' }}
			title={`app-block-${buildId}`}
			onLoad={onLoad}
		/>
	)
}

const ContentDisplay = ({
	content,
	onOverflowChange = () => {},
	showFullContent,
	showScrollBar,
}) => {
	const [blocks, setBlocks] = useState([])
	const contentRef = useRef(null)
	const iframeRefs = useRef({})
	const maxHeightStyle = showFullContent ? 'none' : '50vh'
	const overflowStyle = showScrollBar ? 'auto' : 'hidden'

	useEffect(() => {
		const parser = new DOMParser()
		const doc = parser.parseFromString(content || '', 'text/html')
		const divs = doc.querySelectorAll('.content-block')
		const parsed = []
		divs.forEach(div => {
			if (div.classList.contains('text-block')) {
				parsed.push({ html: div.innerHTML.trim(), type: 'text' })
			} else if (div.classList.contains('code-block')) {
				const code = div.getAttribute('data-code') || ''
				parsed.push({ code, id: div.getAttribute('data-blockid'), type: 'code' })
			} else if (div.classList.contains('media-block')) {
				const align = div.getAttribute('data-align') || 'left'
				const img = div.querySelector('img')
				const video = div.querySelector('video')
				if (img) {
					parsed.push({ align, isImage: true, isVideo: false, type: 'media', url: img.src })
				} else if (video) {
					const source = video.querySelector('source')
					parsed.push({
						align,
						fileType: source ? source.type : '',
						isImage: false,
						isVideo: true,
						type: 'media',
						url: source ? source.src : '',
					})
				} else {
					parsed.push({ align, isImage: false, isVideo: false, type: 'media', url: '' })
				}
			} else if (div.classList.contains('app-block')) {
				parsed.push({ buildId: div.getAttribute('data-buildid'), type: 'app' })
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
					return <AppBlock buildId={block.buildId} key={block.buildId} />
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