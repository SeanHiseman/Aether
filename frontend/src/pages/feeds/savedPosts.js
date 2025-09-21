import axios from 'axios';
import { v4 } from 'uuid';
import { AuthContext } from '../../components/authContext';
import { FaPlus } from 'react-icons/fa';
import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ChannelList from '../../components/channels/channelList';
import ContentWidget from '../../components/content/contentWidget';

const SavedPosts = () => {
	const { channel_name } = useParams();
	const { isAuthenticated, viewer } = useContext(AuthContext);
	const [channels, setChannels] = useState([]);
	const [posts, setPosts] = useState([]);
	const [savedError, setSavedError] = useState('');
	const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated || !channel_name) return;
        //const current = channels.find(c => c.channel_name === channel_name);
    	//if (!current) return;
        async function fetchPosts() {
            try {
                //const response = await axios.get(`/api/get_saved_posts/${current?.channel_id}`);
				const response = await axios.get(`/api/get_saved_posts`);
                setPosts(response.data?.posts);
            } catch (error) {
                setSavedError('Error loading posts');
            }
        }
        void fetchPosts();
    }, [channels, channel_name, isAuthenticated]);

	const addChannel = async () => {
		try {
			const name = `New channel ${channels.length + 1}`;
			const { data } = await axios.post('/api/add_feed_channel', {
				channelName: name,
				isSaved: true
			});
			setChannels([data.newChannel, ...channels]);
			navigate(`/saved/${name}`);
		} catch (error) {
			setSavedError('Error creating channel');
		}
	};

	const saveToggle = (postId, isSaved) => {
		try {
			if (!isSaved) {
				setPosts(prev => prev.filter(p => p?.post_id !== postId));
			}
		} catch (error) {
			setSavedError("Error")
		}
	};

	const currentChannel = channels.find(c => c?.channel_name === channel_name);

	return (
		<div className="standard-container">
			<div className="channel-feed">
				{/*{currentChannel && (*/}
					{posts.length > 0
						? <ul className="content-list">
							{posts.map((post) => (
								<ContentWidget
									canRemove={false}
									feed={{ feed_id: viewer?.feed_id, is_group: false }}
									isDraft={false}
									isGroup={false}
									key={post.post_id}
									onEditClick={() => {}}
									onPostRemoved={() => {}}
									onReplyClick={() => {}}
									onSaveToggle={saveToggle}
									post={post}
								/>
							))}
						</ul>
						: <p className="large-text faded-text">No posts yet</p>}
				{/*})}*/}
				{/*{!currentChannel && <p className="text36">Choose a channel</p>}*/}
			</div>
			<aside className="right-aside">
				<p className="large-text">Saved posts</p>
				{/*<button className="small-icon" onClick={addChannel} title="New channel">
					<FaPlus />
				</button>*/}
				{/*<ChannelList
					canReorder={true}
					channels={channels}
					feedId="saved"
					feedName="saved"
					isChat={false}
					isGroup={false}
					isSaved={true}
					setChannels={setChannels}
				/>*/}
				<div className="error-message">{savedError}</div>
			</aside>
		</div>
	);
};

export default SavedPosts;