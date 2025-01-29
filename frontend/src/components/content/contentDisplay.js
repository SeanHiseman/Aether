import debounce from 'lodash.debounce';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState } from 'react';

const ContentDisplay = ({
  content,
  onOverflowChange = () => {},
  showFullContent,
  showScrollBar
}) => {
  const [iframeHeight, setIframeHeight] = useState('auto');
  const iframeRef = useRef(null);
  const overflowStyle = showScrollBar ? 'auto' : 'visible';

  useEffect(() => {
    if (!iframeRef.current) return;
    const iframeWindow = iframeRef.current.contentWindow;
    const iframeDoc = iframeRef.current.contentDocument || iframeWindow.document;
    if (!iframeDoc) return;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            overflow: ${overflowStyle};
            padding: 0;
          }
          img, video, iframe, embed, object {
            display: block;
            height: auto;
            margin: 10px 0;
            max-width: 100%;
          }
          pre, code, .code-block {
            border-radius: 0;
            box-sizing: border-box;
            color: #ccc;
            padding: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            width: 100%;
          }
          .content-block {
            box-sizing: border-box;
            display: block;
            width: 100%;
          }
          iframe {
            display: block;
            min-height: 100px;
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
    iframeDoc.close();
    const adjustHeight = debounce(() => {
      const newHeight = iframeDoc.body.scrollHeight;
      setIframeHeight(`${newHeight}px`);
      onOverflowChange(false);
    }, 100);
    adjustHeight();
    const observer = new MutationObserver(adjustHeight);
    observer.observe(iframeDoc.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    const mediaElements = iframeDoc.querySelectorAll('img, video, iframe');
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
  }, [content, onOverflowChange, overflowStyle, showScrollBar]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{
        border: 'none',
        height: iframeHeight,
        transition: 'height 0.3s ease',
        width: '100%'
      }}
      title="Content Preview"
    />
  );
};

ContentDisplay.propTypes = {
  content: PropTypes.string.isRequired,
  onOverflowChange: PropTypes.func,
  showFullContent: PropTypes.bool.isRequired,
  showScrollBar: PropTypes.bool.isRequired
};

export default ContentDisplay;
