import React, { useEffect, useRef } from 'react';

const ContentDisplay = ({ content }) => {
    const iframeRef = useRef(null);

    useEffect(() => {
        if (iframeRef.current) {
            const iframeDocument = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
            // Write the dynamic content into the iframe
            iframeDocument.open();
            iframeDocument.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            height: auto;
                            overflow: hidden;
                            box-sizing: border-box;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            color: white; 
                            font-family: Arial, sans-serif;
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `);
            iframeDocument.close();
            // Adjust iframe height to match content
            const adjustHeight = () => {
                const contentHeight = iframeDocument.body.scrollHeight;
                iframeRef.current.style.height = `${contentHeight}px`;
            };
            iframeDocument.body.onload = adjustHeight;
            const observer = new MutationObserver(() => {
                adjustHeight();
            });
            observer.observe(iframeDocument.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            return () => observer.disconnect();
        } 
    }, [content]);

    return (
        <iframe
            ref={iframeRef}
            style={{
                //alignItems: "center",
                border: "none",
                //display: "flex",
                width: "100%",
            }}
        />
    );
};

export default ContentDisplay;

