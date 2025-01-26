import debounce from 'lodash.debounce'
import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

const ContentDisplay = ({ content, onOverflowChange = () => {}, showFullContent, showScrollBar }) => {
  const iframeRef = useRef(null)
  const [iframeHeight, setIframeHeight] = useState('auto')
  const overflowStyle = showScrollBar ? 'auto' : 'hidden'

  //Write the HTML once when `content` changes
  useEffect(() => {
    if (!iframeRef.current) return
    const iframeWindow = iframeRef.current.contentWindow
    const iframeDoc = iframeRef.current.contentDocument || iframeWindow.document
    if (!iframeDoc) return
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            background-color: none;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px;
            overflow: hidden;
          }
          img, video, iframe, embed, object {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
          }
          pre, code {
            color: #ccc;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `)
    iframeDoc.close()
  }, [content])

  // Adjust height and overflow without rewriting the iframe
  useEffect(() => {
    if (!iframeRef.current) return
    const iframeWindow = iframeRef.current.contentWindow
    const iframeDoc = iframeRef.current.contentDocument || iframeWindow.document
    if (!iframeDoc) return
    iframeDoc.body.style.overflow = overflowStyle

    const adjustHeight = debounce(() => {
      const newHeight = iframeDoc.body.scrollHeight
      const halfViewportHeight = window.innerHeight * 0.5
      if (showFullContent || newHeight <= halfViewportHeight) {
        setIframeHeight(`${newHeight}px`)
      } else {
        setIframeHeight('50vh')
      }
      onOverflowChange(newHeight > halfViewportHeight)
    }, 100)

    adjustHeight()

    const observer = new MutationObserver(adjustHeight)
    observer.observe(iframeDoc.body, { childList: true, subtree: true, characterData: true })

    const mediaElements = iframeDoc.querySelectorAll('img, video')
    mediaElements.forEach((media) => {
      media.addEventListener('load', adjustHeight)
      media.addEventListener('loadedmetadata', adjustHeight)
    })

    return () => {
      observer.disconnect()
      mediaElements.forEach((media) => {
        media.removeEventListener('load', adjustHeight)
        media.removeEventListener('loadedmetadata', adjustHeight)
      })
      adjustHeight.cancel()
    }
  }, [onOverflowChange, overflowStyle, showFullContent])

  return (
    <iframe
      ref={iframeRef}
      title="Content Preview"
      sandbox="allow-scripts allow-same-origin"
      style={{
        border: 'none',
        borderRadius: '10px',
        width: '100%',
        height: iframeHeight,
        transition: 'height 0.3s ease'
      }}
    />
  )
}

ContentDisplay.propTypes = {
  content: PropTypes.string.isRequired,
  onOverflowChange: PropTypes.func,
  showFullContent: PropTypes.bool.isRequired,
  showScrollBar: PropTypes.bool.isRequired
}

export default ContentDisplay;





