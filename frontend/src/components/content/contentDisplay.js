// ContentDisplay.jsx
import React, { useEffect, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';

const ContentDisplay = ({
  content,
  onOverflowChange = () => {}, // Default no-op function
  showFullContent,
  showScrollBar,
}) => {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState('auto');
  const overflowStyle = showScrollBar ? 'auto' : 'hidden';

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframeWindow = iframeRef.current.contentWindow;
    const iframeDoc = iframeRef.current.contentDocument || iframeWindow.document;
    if (!iframeDoc) return;

    // Write content to iframe
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            background-color: transparent;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px;
            overflow: ${overflowStyle};
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
    `);
    iframeDoc.close();

    // Adjust iframe height
    const adjustHeight = debounce(() => {
        const newHeight = iframeDoc.body.scrollHeight;
        setIframeHeight(showFullContent ? `${newHeight}px` : '50vh');
        onOverflowChange(newHeight > window.innerHeight * 0.5);
      }, 100);

    // Initial height adjustment
    adjustHeight();

    // Observe changes for dynamic height adjustment
    const observer = new MutationObserver(adjustHeight);
    observer.observe(iframeDoc.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Handle media load events
    const mediaElements = iframeDoc.querySelectorAll('img, video');
    mediaElements.forEach((media) => {
      media.addEventListener('load', adjustHeight);
      media.addEventListener('loadedmetadata', adjustHeight);
    });

    return () => {
      observer.disconnect();
      mediaElements.forEach((media) => {
        media.removeEventListener('load', adjustHeight);
        media.removeEventListener('loadedmetadata', adjustHeight);
      });
      adjustHeight.cancel();
    };
  }, [content, showFullContent, showScrollBar, onOverflowChange]);

  return (
    <iframe
      ref={iframeRef}
      title="Content Preview"
      sandbox="allow-scripts allow-same-origin" // Added sandbox for security
      style={{
        border: 'none',
        borderRadius: '10px',
        width: '100%',
        height: iframeHeight,
        transition: 'height 0.3s ease',
      }}
    />
  );
};

ContentDisplay.propTypes = {
  content: PropTypes.string.isRequired,
  onOverflowChange: PropTypes.func,
  showFullContent: PropTypes.bool.isRequired,
  showScrollBar: PropTypes.bool.isRequired,
};

export default ContentDisplay;




