import React, { useEffect, useRef, useState } from 'react';

const ContentDisplay = ({ content, currentTheme, onOverflowChange, showFullContent, showScrollBar }) => {
    const iframeRef = useRef(null);
    const [iframeHeight, setIframeHeight] = useState('50vh');
    const overflowStyle = showScrollBar ? 'auto' : 'hidden';

    useEffect(() => {
        if (iframeRef.current) {
            const iframeDocument = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
            //Write the dynamic content into the iframe
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
                            margin: 0;
                            max-width: 100%;
                            overflow: ${overflowStyle};
                            padding: 0;
                        }
                        img, video, iframe, embed, object {
                            max-width: 97%;
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
            const measureHeight = () => {
                const fullHeight = iframeDocument.body.scrollHeight;
                const threshold = window.innerHeight * 0.5;
                if (fullHeight > threshold) {
                    if (showFullContent) {
                        setIframeHeight(`${fullHeight}px`);
                    } else {
                        setIframeHeight('50vh');
                    }
                    onOverflowChange(true); //Causes error when editing form gets too long
                } else {
                    setIframeHeight(`${fullHeight}px`);
                    //onOverflowChange(false); this line causes an error
                }
            };
            measureHeight();
            const observer = new MutationObserver(measureHeight);
            observer.observe(iframeDocument.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            Array.from(iframeDocument.querySelectorAll('img, video')).forEach((media) => {
                media.addEventListener('load', measureHeight);
                media.addEventListener('loadedmetadata', measureHeight);
            });
            return () => {
                observer.disconnect();
                Array.from(iframeDocument.querySelectorAll('img, video')).forEach((media) => {
                    media.removeEventListener('load', measureHeight);
                    media.removeEventListener('loadedmetadata', measureHeight);
                });
            };
        }
    }, [content, currentTheme, onOverflowChange, overflowStyle, showFullContent]);

    return (
        <iframe
            ref={iframeRef}
            title="Content iframe"
            style={{
                border: "none",
                height: iframeHeight,
                margin: "10px",
                transition: "height 0.3s ease",
                width: "100%",
            }}
        />
    );
};

export default ContentDisplay;

