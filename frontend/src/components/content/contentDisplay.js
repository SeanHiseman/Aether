import React, { useEffect, useRef, useState } from 'react';

const ContentDisplay = ({ content, currentTheme, onOverflowChange, showFullContent, showScrollBar }) => {
    const iframeRef = useRef(null);
    const [iframeHeight, setIframeHeight] = useState('50vh');
    const overflowStyle = showScrollBar ? 'auto' : 'hidden';

    //Write content only when it changes
    useEffect(() => {
        if (!iframeRef.current) return;
        const iframeDocument =
        iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        if (!iframeDocument) return;
        iframeDocument.open();
        iframeDocument.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="../../css/variables.css">
            <style>
            body {
                background-color: transparent;
                color: white;
                display: flex;
                font-family: Arial, sans-serif;
                justify-content: center;
                margin: 10px;
                max-width: 100%;
                overflow: ${overflowStyle};
                padding: 0;
            }
            img, video, iframe, embed, object {
                max-width: 100%;
                height: auto;
                display: block;
            }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
        `);
        iframeDocument.close();
        //Measure height right after writing
        const measureHeight = () => {
            const fullHeight = iframeDocument.body.scrollHeight;
            const threshold = window.innerHeight * 0.5;
            if (fullHeight > threshold) {
                setIframeHeight('50vh');
                onOverflowChange(true);
            } else {
                setIframeHeight(`${fullHeight}px`);
                onOverflowChange(false);
            }
        };
        measureHeight();
        //Observe DOM changes so it can auto-resize for images, etc.
        const observer = new MutationObserver(measureHeight);
        observer.observe(iframeDocument.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        //Also watch images and videos
        const mediaElements = iframeDocument.querySelectorAll('img, video');
        mediaElements.forEach((media) => {
            media.addEventListener('load', measureHeight);
            media.addEventListener('loadedmetadata', measureHeight);
        });
        return () => {
            observer.disconnect();
            mediaElements.forEach((media) => {
                media.removeEventListener('load', measureHeight);
                media.removeEventListener('loadedmetadata', measureHeight);
            });
        };
    }, [content, currentTheme, overflowStyle, onOverflowChange]);

    //Whenever "Show More" toggles, just adjust the existing iframe's height
    useEffect(() => {
        if (!iframeRef.current) return;
        const iframeDocument =
        iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        if (!iframeDocument) return;
        const fullHeight = iframeDocument.body.scrollHeight;
        const threshold = window.innerHeight * 0.5;
        if (fullHeight > threshold) {
            if (showFullContent) {
                setIframeHeight(`${fullHeight}px`);
            } else {
                setIframeHeight('50vh');
            }
            onOverflowChange(true);
        } else {
            setIframeHeight(`${fullHeight}px`);
            onOverflowChange(false);
        }
    }, [showFullContent, onOverflowChange]);

    return (
        <iframe
        ref={iframeRef}
        title="Content iframe"
        style={{
            border: 'none',
            height: iframeHeight,
            transition: 'height 0.3s ease',
            width: '100%',
        }}
        />
    );
};

export default ContentDisplay;


