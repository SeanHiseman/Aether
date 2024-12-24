import axios from 'axios';
import React, { useState } from 'react';

const AskButton = ({ isReply, isGroup, content, showNote, setShowNote, note, setNote }) => {
    const [isLoading, setIsLoading] = useState(false);

    //Extracts posts content from raw format
    const stripHtmlTags = (content) => {
        return content.content.replace(/<[^>]*>?/gm, '');
    };

    const askPost = async () => {
        try {
            if (showNote) {
                setShowNote(false);
            } else {
                if (note) {
                    setShowNote(true);
                } else {
                    setIsLoading(true);
                    const normalisedContent = stripHtmlTags(content);
                    const id = isReply ? content.reply_id : content.post_id;
                    const response = await axios.post('/api/ask_button', {
                        isGroup,
                        isReply,
                        postTitle: content.title,
                        postContent: normalisedContent,
                        id,
                    });
                    const { newNote } = response.data;
                    setNote(newNote.note_content);
                    setShowNote(true);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            className={`${isLoading ? 'button-disabled' : 'button'}`}
            onClick={askPost}
            disabled={isLoading}
        >
            {showNote ? 'Close' : (isLoading ? 'Loading...' : 'Ask')}
        </button>
    );
};

export default AskButton;
