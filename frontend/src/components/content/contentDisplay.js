import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

const ContentDisplay = ({ content, onOverflowChange = () => {}, showFullContent, showScrollBar }) => {
  const [blocks, setBlocks] = useState([])
  const iframeRefs = useRef({})
  const contentRef = useRef(null)
  const overflowStyle = showScrollBar ? 'auto' : 'hidden'
  const maxHeightStyle = showFullContent ? 'none' : '50vh'

  useEffect(() => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content || '', 'text/html')
    const divs = doc.querySelectorAll('.content-block')
    const parsed = []
    divs.forEach((div) => {
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
          parsed.push({ type: 'media', url: img.src, isImage: true, isVideo: false, align })
        } else if (video) {
          const source = video.querySelector('source')
          parsed.push({ type: 'media', url: source ? source.src : '', isImage: false, isVideo: true, fileType: source ? source.type : '', align })
        } else {
          parsed.push({ type: 'media', isImage: false, isVideo: false, url: '', align })
        }
      }
    })
    setBlocks(parsed)
  }, [content])

  useEffect(() => {
    function handleMessage(e) {
      if (!e.data || !e.data.height || !e.data.blockId) return
      if (iframeRefs.current[e.data.blockId]) {
        iframeRefs.current[e.data.blockId].style.height = `${e.data.height}px`
        debounceCheckOverflow()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    debounceCheckOverflow()
  }, [blocks])

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      debounceCheckOverflow()
    })
    if (contentRef.current) {
      observer.observe(contentRef.current)
    }
    return () => {
      if (contentRef.current) {
        observer.unobserve(contentRef.current)
      }
      observer.disconnect()
    }
  }, [blocks])

  const debounce = (func, delay) => {
    let timer
    return () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        func()
      }, delay)
    }
  }

  const checkOverflow = () => {
    if (contentRef.current) {
      const currentHeight = contentRef.current.scrollHeight
      const maxAllowedHeight = window.innerHeight * 0.5
      if (currentHeight > maxAllowedHeight) {
        onOverflowChange(true)
      } else {
        onOverflowChange(false)
      }
    }
  }

  const debounceCheckOverflow = debounce(checkOverflow, 100)

  return (
    <div
      ref={contentRef}
      style={{
        borderTopLeftRadius: 'calc(var(--large-margin) + 0.8vw)',
        borderTopRightRadius: 'calc(var(--large-margin) + 0.8vw)',
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
              ref={(el) => {
                iframeRefs.current[block.id] = el
              }}
              sandbox="allow-scripts allow-same-origin"
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { margin: 0; padding: 0; }
                  </style>
                </head>
                <body>
                  ${block.code}
                  <script>
                    function sendHeight() {
                      const height = document.body.scrollHeight;
                      parent.postMessage({ blockId: '${block.id}', height }, '*');
                    }
                    window.addEventListener('load', sendHeight);
                    window.addEventListener('resize', sendHeight);
                    const obs = new MutationObserver(sendHeight);
                    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
                  </script>
                </body>
                </html>
              `}
              style={{ border: 'none', height: '0px', width: '100%' }}
              title={`code-block-${block.id}`}
            />
          )
        }
        if (block.type === 'media') {
          const styleObj = block.align === 'center'
            ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }
            : { maxWidth: '100%', height: 'auto' }
          if (block.isImage) {
            return <img alt="Uploaded Media" key={i} src={block.url} style={styleObj} />
          }
          if (block.isVideo) {
            return (
              <video controls key={i} style={styleObj}>
                <source src={block.url} type={block.fileType || 'video/*'} />
              </video>
            )
          }
          return <div key={i}>Unsupported</div>
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

export default ContentDisplay;