import axios from 'axios';
import React, { useState } from 'react';

const AskButton = ({ isReply, isGroup, content, showNote, setShowNote, note, setNote, setPostErrorMessage }) => {
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
                        isGroup, isReply, postTitle: content.title, postContent: normalisedContent, id,
                    });
                    const { newNote } = response.data;
                    setNote(newNote.note_content);
                    setShowNote(true);
                }
            }
        } catch (error) {
            setPostErrorMessage("Error using Ask.");
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button className={`small-icon ${isLoading ? 'button disabled' : 'button'}`} disabled={isLoading} onClick={askPost} title={showNote ? 'Close Note' : isLoading ? 'Loading Note...' : 'Ask'}>
            {showNote ? 'Close' : (isLoading ? 'Loading...' : <img className="standard-icon" src="/media/site_images/icons/ask.png" alt="Ask"/>)}
        </button>
    );
};

export default AskButton;
