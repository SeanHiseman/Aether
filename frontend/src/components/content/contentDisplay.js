import debounce from 'lodash.debounce'
import PropTypes from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'

const ContentDisplay = ({ content, onOverflowChange = () => {}, showFullContent, showScrollBar }) => {
  const [iframeHeight, setIframeHeight] = useState('auto')
  const iframeRef = useRef(null)
  const overflowStyle = showScrollBar ? 'auto' : 'hidden'

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
            padding: 0;
            overflow: ${overflowStyle};
          }
          img, video, iframe, embed, object {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px 0;
          }
          pre, code, .code-block {
            border-radius: 0;
            border-sizing: border-box;
            color: #ccc;
            overflow-x: auto;
            padding: 0;
            width: 100%;
          }
          .content-block {
            border-sizing: border-box;
            display: block;
            width: 100%;
          }
          .code-iframe {
            height: auto;
            width: 100%;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `);
    iframeDoc.close()
    const adjustHeight = debounce(() => {
      const newHeight = iframeDoc.body.scrollHeight
      if (showFullContent) {
        setIframeHeight(`${newHeight}px`)
      } else {
        setIframeHeight('50vh')
      }
      onOverflowChange(newHeight > window.innerHeight * 0.5)
    }, 100)
    adjustHeight()
    const observer = new MutationObserver(adjustHeight)
    observer.observe(iframeDoc.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
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
  }, [content, onOverflowChange, showFullContent, showScrollBar])

  return (
    <iframe
      ref={iframeRef}
      title="Content Preview"
      sandbox="allow-scripts allow-same-origin"
      style={{
        border: 'none',
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








