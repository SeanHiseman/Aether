import React, { useEffect, useRef, useState } from 'react';

const ContentDisplay = ({ content, showFullContent }) => {
    const iframeRef = useRef(null);
    const [iframeHeight, setIframeHeight] = useState('50vh');

    useEffect(() => {
        if (iframeRef.current) {
            const iframeDocument = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
            //Write the dynamic content into the iframe
            iframeDocument.open();
            iframeDocument.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            background-color: transparent;
                            display: flex;
                            color: white; 
                            font-family: Arial, sans-serif;
                            margin: 0;
                            max-width: 100%;
                            justify-content: center;
                            padding: 0;
                        }
                        img, video, iframe, embed, object {
                            max-width: 90%;
                            height: auto;
                            display: block;
                            margin: 10px 0;
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
                if (showFullContent) {
                    setIframeHeight(`${fullHeight}px`);
                } else {
                    setIframeHeight('50vh');
                }
            };
            measureHeight();
            const observer = new MutationObserver(measureHeight);
            observer.observe(iframeDocument.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            return () => observer.disconnect();
        }
    }, [content, showFullContent]);

    return (
        <iframe
            ref={iframeRef}
            title="Content iframe"
            style={{
                border: "none",
                height: iframeHeight,
                transition: "height 0.3s ease",
                width: "100%",
            }}
        />
    );
};

export default ContentDisplay;

