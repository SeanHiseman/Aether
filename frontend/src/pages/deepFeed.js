import axios from 'axios';
import AlgorithmSelector from '../algorithms/algorithmSelector'; //Project code
import { DragDropContext } from 'react-beautiful-dnd';
import { useContext, useEffect, useRef, useState } from 'react';
import { FaEdit, FaRegWindowClose, FaSave, FaTrash } from 'react-icons/fa';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AuthContext } from '../components/authContext';
import ContentForm from '../components/content/contentForm';
import ContentWidget from '../components/content/contentWidget';
import DeepFeedItem from '../components/channels/deepFeedItem';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ValidateTextInput } from '../functions/validateTextInput';

const DeepFeed = () => {
    const [activeEditPost, setActiveEditPost] = useState(null);
    const [activeReplyPost,	setActiveReplyPost]	= useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const { deep_feed_id } = useParams();
    const [deepFeed, setDeepFeed] = useState({ deep_feed_id: null, name: '', owner_id: null, parent_id: null });
    const [isEditingName, setIsEditingName] = useState(false);
    const [isNewNameValid, setIsNewNameValid] = useState(false);
    const [newName, setNewName] = useState('');
    const [postErrorMessage, setPostErrorMessage] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const { isAuthenticated, user, viewer } = useContext(AuthContext);
    const navigate = useNavigate();
    const { rightClasses } = useOutletContext(); 
    const queryClient = useQueryClient();
    const CLEANUP_THRESHOLD = 100; //Remove old posts and feeds from rendered list

    const getPosts = async ({ pageParam = 0 }) => {
        try {
            const response = await axios.get('/api/deep_feed_posts', {
                params: {
                    deepFeedId: deep_feed_id,
                    limit: 10,
                    offset: pageParam
                }
            });
            if (pageParam === 0 && response.data.deepFeed) {
                setDeepFeed(response.data.deepFeed);
                document.title = response.data.deepFeed.name;
            } else if (deep_feed_id === 'following') {
                setDeepFeed({
                    deep_feed_id: 'following',
                    name: 'Following',
                    owner_id: 'system',
                    parent_id: null,
                });
                document.title = 'Following';
            }
            return response.data.posts;
        } catch (error) {
            setErrorMessage('Error fetching posts');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            return [];
        }
    };

    const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, status } = useInfiniteQuery({
        queryKey: ['deepFeedPosts', deep_feed_id],
        queryFn: getPosts,
        getNextPageParam: (lastPage, allPages) => {
            if (!Array.isArray(lastPage)) return undefined;
            return lastPage.length === 10 ? allPages.length * 10 : undefined;
        }
    });

    const loaderRef = useRef(null);

    const changeDeepFeedName = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post('/api/change_deep_feed_name', {
                deepFeedId: deep_feed_id,
                newName
            });
            if (response.status === 200) {
                setErrorMessage('');
                setIsEditingName(false);
                setNewName('');
                setDeepFeed((prev) => ({ ...prev, name: newName }));
                document.title = newName;
            } 
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Error changing name");
            setTimeout(() => { setErrorMessage(''); }, 5000);
        }
    };

    const deletePost = async () => {
        if (window.confirm(`Are you sure you want to delete ${deepFeed.name}?`)) {
            try {
                if (deepFeed.name === 'Following') {
                    setErrorMessage("Following cannot be deleted.");
                    setTimeout(() => { setErrorMessage(''); }, 5000);
                    return;
                }
                const response = await axios.delete('/api/delete_deep_feed', { data: { deepFeedId: deep_feed_id } });
                if (response.data.success) {
                    setDeepFeed((prev) => {
                        const updated = { name: 'Following' };
                        for (const key in prev) {
                            if (key !== 'name') {
                                updated[key] = null;
                            }
                        }
                        return updated;
                    });                    
                    setErrorMessage('');
                    navigate('/d/following');
                }
            } catch (error) {
                setErrorMessage(error.response?.data?.message || 'Error deleting combined feed');
                setTimeout(() => { setErrorMessage(''); }, 5000);
            }
        }
    };

    //For creating replies
    const postSubmit = async (formData) => {
        if (!isAuthenticated) return;
        if (!formData) {
            setPostErrorMessage("Post cannot be empty");
            setTimeout(() => { setPostErrorMessage(''); }, 3000);
            return;
        }
        try {
            formData.append('poster_id', viewer?.feed_id);
            await axios.post('/api/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const draftId = formData.get('draft_id');
            if (draftId) {
                await axios.delete('/api/remove_draft', {
                    headers: { 'Content-Type': 'application/json' },
                    data: { draft: { draft_id: draftId } }
                });   
            }    
            setActiveReplyPost(null);
        } catch (error) {
            if (error.response && error.response.status === 413) {
                setPostErrorMessage(error.response.data.message + (!user.has_membership ? ". Get membership for more" : ""));
                setTimeout(() => { setPostErrorMessage(''); }, 10000);
            } else {
                setPostErrorMessage(error.response.data?.message || "Error creating post");
                setTimeout(() => { setPostErrorMessage(''); }, 3000);
            }
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        });
        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }
        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [loaderRef, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const allPosts = Array.isArray(data?.pages) ? data.pages.flatMap(page => Array.isArray(page) ? page : []) : [];

    const editSubmit = async (formData) => {
        if (!activeEditPost) return;
        try {
            formData.append('post_id', activeEditPost.post_id);
            await axios.post('/api/edit_post', formData);
            setActiveEditPost(null);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error editing post');
            setTimeout(() => { setErrorMessage('') }, 3000);
        }
    };

    const refreshPosts = () => {
        setRefreshTrigger(!refreshTrigger);
    };

    //Refresh posts upon algorithm change
    useEffect(() => {
        if (refreshTrigger === false) return;
        queryClient.invalidateQueries(['deepFeedPosts', deep_feed_id]);
        queryClient.refetchQueries(['deepFeedPosts', deep_feed_id]);
    }, [refreshTrigger, queryClient, deep_feed_id]);

    return (
        <div className="standard-container">
            <div className="channel-feed">
                <div className="channel-content">
                    {activeEditPost ? (
						<ContentForm
							key={`edit-${activeEditPost.post_id}`}
							channelId={activeEditPost.parentChannel?.channel_id}
							feed={activeEditPost.parentChannel?.feed}
							isEdit={true}
							isGroup={activeEditPost.poster?.feed_id !== activeEditPost.feed_id}
							isReply={false}
							onEditSubmit={editSubmit}
							post={activeEditPost}
							postErrorMessage={postErrorMessage}
							setPostErrorMessage={setPostErrorMessage}
							setShowForm={() => setActiveEditPost(null)}
						/>
                    ) : activeReplyPost ? (
                        <ContentForm
                            key={`reply-${activeReplyPost.post_id}`}
                            channelId={activeReplyPost.parentChannel?.channel_id}
                            feed={activeReplyPost.parentChannel?.feed}
                            isEdit={false}
                            isGroup={activeReplyPost.poster?.feed_id === activeReplyPost.feed_id ? false : true}
                            isReply={true}
                            onEditSubmit={editSubmit}
                            onPostSubmit={postSubmit}
                            post={activeReplyPost}
                            postErrorMessage={postErrorMessage}
                            setPostErrorMessage={setPostErrorMessage}
                            setShowForm={() => setActiveReplyPost(null)}
                        />
                    ) : allPosts.length > 0 ? (
                        <>
                            <ul className="content-list">
                                {allPosts.map((post) => (
                                    post ? (
                                        <ContentWidget
                                            key={post.post_id || Math.random()}
                                            canRemove={false}
                                            feed={post.poster || {}}
                                            onEditClick={setActiveEditPost}
                                            onPostRemoved={() => {}}
                                            onReplyClick={setActiveReplyPost}
                                            post={post}
                                        />
                                    ) : null
                                ))}
                            </ul>
                            <div ref={loaderRef}>
                                {isFetchingNextPage && <p className="text36">Loading more posts...</p>}
                            </div>
                        </>
                    ) : (
                        <p className="text36">No posts yet</p>
                    )}
                </div>
            </div>
            <aside className={rightClasses}>
                <div className="channel-name-section">
                    {isEditingName ? (
                        <div className="change-name">
                            <textarea
                                className="change-name-area"
                                onChange={(e) => {
                                    const input = e.target.value;
                                    setNewName(input);
                                    if (input) {
                                        if (input.trim() === 'following') {
                                            setErrorMessage("Cannot be named 'Following'");
                                        } else {
                                            const result = ValidateTextInput(input, 1, 30);
                                            if (result.valid) {
                                                setErrorMessage("");
                                                setIsNewNameValid(true);
                                            } else {
                                                setErrorMessage(result.error);
                                                setIsNewNameValid(true);
                                            }
                                        }
                                    } else {
                                        setErrorMessage("");
                                        setIsNewNameValid(true);
                                    }
                                }}
                                placeholder="New name"
                                value={newName} />
                            <div className="cancel-save">
                                <button className="small-icon" onClick={() => {setIsEditingName(false); setNewName(""); setErrorMessage("");}} title="Cancel">
                                    <FaRegWindowClose />
                                </button>
                                <button className={!isNewNameValid ? "small-icon disabled" : "small-icon"} onClick={changeDeepFeedName} title="Save">
                                    <FaSave />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="channel-name">
                            <p className="text36">{deepFeed.name}</p>
                            <div className="button-group">
                                {deepFeed?.name !== "Following" && ( 
                                    <>
                                        <button
                                            className="small-icon"
                                            onClick={() => {
                                                setIsEditingName(true);
                                                setNewName(deepFeed.name);
                                            }}
                                            title="Edit name"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button className="small-icon" onClick={deletePost} title="Delete Deep Feed">
                                            <FaTrash />
                                        </button>
                                    </>
                                )}
                            </div>
                            {isAuthenticated && <AlgorithmSelector locationId={deepFeed.deep_feed_id} refreshPosts={refreshPosts} />} {/*Project code*/}
                        </div>
                    )}
                    <div className="error-message">{errorMessage}</div>
                </div>
            </aside>
        </div>
    );
}

export default DeepFeed;