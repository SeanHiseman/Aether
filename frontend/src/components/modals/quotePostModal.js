import { AuthContext } from '../authContext';
import { FaTimes } from 'react-icons/fa';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';

const QuotePostModal = ({ post, externalPost, onClose }) => {
    console.log('QuotePostModal props - post:', post, 'externalPost:', externalPost);
    const navigate = useNavigate();
    const { viewer } = useContext(AuthContext);

    const handleQuote = () => {
        if (externalPost) {
            // For external posts, navigate to the viewer's personal feed Main channel
            if (!viewer?.feed_name) {
                console.error('No viewer feed_name available');
                return;
            }
            navigate(
                `/u/${viewer.feed_name}/Main/create`,
                {
                    state: {
                        quotedExternalPost: externalPost
                    }
                }
            );
        } else {
            const urlPrefix = post?.parentChannel?.feed?.is_group ? 'g' : 'u';
            navigate(
                `/${urlPrefix}/${post?.parentChannel?.feed?.feed_name}/${post?.parentChannel?.channel_name}/create`,
                {
                    state: {
                        quotedPost: post
                    }
                }
            );
        }
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex">
                    <button className="small-icon" onClick={onClose}>
                        <FaTimes />
                    </button>
                    <p className="medium-text">Quote Post</p>
                </div>
                <div className="modal-body">
                    <p className="small-text">
                        Create a new post with this {externalPost ? 'external post' : 'post'} quoted. You'll be taken to the post editor.
                    </p>
                    <div className="quoted-post-preview" style={{ border: '2px solid var(--light)', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
                        {externalPost ? (
                            <>
                                <div className="feed-info" style={{ marginBottom: '8px' }}>
                                    <img
                                        className="small-feed-photo"
                                        src={externalPost?.author_photo}
                                        onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
                                        alt={externalPost?.author}
                                    />
                                    <span className="small-text">{externalPost?.author}</span>
                                    <span className="small-text faded-text" style={{ marginLeft: '8px' }}>
                                        • {externalPost?.source}
                                    </span>
                                </div>
                                {externalPost?.title && (
                                    <p className="medium-text" style={{ fontWeight: 600, marginBottom: '8px' }}>
                                        {externalPost?.title}
                                    </p>
                                )}
                                {externalPost?.text_body && (
                                    <p className="small-text faded-text">
                                        {externalPost.text_body.substring(0, 200)}
                                        {externalPost.text_body.length > 200 ? '...' : ''}
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="feed-info" style={{ marginBottom: '8px' }}>
                                    <img className="small-feed-photo" src={post?.poster?.feed_photo} onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'} alt={post?.poster?.feed_name} />
                                    <span className="small-text">{post?.poster?.feed_name}</span>
                                </div>
                                {post?.title && (
                                    <p className="medium-text" style={{ fontWeight: 600, marginBottom: '8px' }}>
                                        {post?.title}
                                    </p>
                                )}
                                <p className="small-text faded-text">
                                    {post?.text_body?.substring(0, 200)}
                                    {post?.text_body?.length > 200 ? '...' : ''}
                                </p>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-center">
                    <button className="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="main-button" onClick={handleQuote}>
                        Open post form
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuotePostModal;