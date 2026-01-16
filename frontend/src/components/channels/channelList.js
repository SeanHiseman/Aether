import api from '../../api';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AuthContext } from '../../components/authContext';
import { CSS } from '@dnd-kit/utilities'; 
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Link, useParams } from 'react-router-dom';
import { UnreadContext } from '../messages/unreadContext';
import { useCallback, useContext, useEffect, useState } from 'react';

const SortableFeedChannelItem = ({ channel, id, url }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const { channel_name } = useParams();
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, cursor: 'grab', touchAction: 'none' };

    return (
        <li ref={setNodeRef} 
            style={style} 
            className={`channel-item ${isDragging ? 'dragging-active' : ''} ${channel?.channel_name === channel_name ? 'selected' : ''}`} 
            {...attributes} 
            {...listeners}>
            <Link to={url} style={{ pointerEvents: isDragging ? 'none' : 'auto' }}>
                <div className={`channel-link ${channel?.channel_name === channel_name ? 'selected' : ''}`}>
                    {channel.channel_name}
                </div>
            </Link>
        </li>
    );
};

const ChannelList = ({ canReorder = false, channels, feedId, feedName, isChat, isGroup, isSaved, setChannels }) => {
    const { channel_name } = useParams();
    const [errorMessage, setErrorMessage] = useState('');
    const { state: unreadState } = useContext(UnreadContext); 
    const urlLetter = isGroup ? 'g' : 'u';
    const { viewer } = useContext(AuthContext);

    const getFeedChannels = useCallback(async () => {
        try {
            if (!isChat) {
                const response = await api.get(`/get_feed_channels/${feedId}`);
                if (response.data.success) {
                    setChannels(response.data?.channels || []);
                } else {
                    setErrorMessage(response.data?.message || 'Error getting channels');
                    setChannels([]);
                }
            } else {
                //Check localStorage first
                const storedChats = localStorage.getItem('connectionChats');
                if (storedChats) {
                    const parsed = JSON.parse(storedChats);
                    const storedConnections = localStorage.getItem('connections');
                    if (storedConnections) {
                        const connections = JSON.parse(storedConnections);
                        const conn = connections.find(c => c.feed_name === feedName);
                        if (conn && parsed[conn.feed_id]) {
                            setChannels(parsed[conn.feed_id]);
                            return;
                        }
                    }
                }
                //API fallback if localStorage fails
                const response = await api.get(`/get_chats/${viewer?.feed_id}`, {
                    params: { connectionName: feedName }
                });
                if (response.data?.success) {
                    const chats = response.data?.chats || [];
                    setChannels(chats);
                    //Save to localStorage
                    const storedConnections = localStorage.getItem('connections');
                    if (storedConnections) {
                        const connections = JSON.parse(storedConnections);
                        const conn = connections.find(c => c.feed_name === feedName);
                        if (conn) {
                            const existingChats = localStorage.getItem('connectionChats');
                            const parsed = existingChats ? JSON.parse(existingChats) : {};
                            parsed[conn.feed_id] = chats;
                            localStorage.setItem('connectionChats', JSON.stringify(parsed));
                        }
                    }
                } else {
                    setErrorMessage(response.data?.message || 'Error getting chats from API');
                    setChannels([]);
                }
            }
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error getting channels');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            setChannels([]);
        }
    }, [feedId, feedName, isChat, setChannels, viewer?.feed_id]);

    useEffect(() => {
        getFeedChannels();
    }, [getFeedChannels]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {  
            activationConstraint: {
                delay: 250,        //Wait 250ms before starting drag
                tolerance: 5,      //Allow 5px movement during delay
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (isChat || !active || !over || active?.id === over?.id) {
            return; 
        }
        const oldIndex = nonMainChannels.findIndex(c => c?.channel_id === active?.id);
        const newIndex = nonMainChannels.findIndex(c => c?.channel_id === over?.id);
        if (oldIndex === -1 || newIndex === -1) {
            return;
        }
        const reorderedChannels = arrayMove(nonMainChannels, oldIndex, newIndex);
        const finalChannels = mainChannel ? [mainChannel, ...reorderedChannels] : reorderedChannels;
        setChannels(finalChannels);
        const orderedChannelIds = reorderedChannels.map(channel => channel?.channel_id);
        try {
            await api.put('/reorder_feed_channels', {
                feed_id: feedId,
                orderedChannelIds: orderedChannelIds
            });
        } catch (error) {
            setErrorMessage(error.response?.data?.message || 'Error saving order');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            getFeedChannels(); 
        }
    };

    const currentChannels = Array.isArray(channels) ? channels : [];
    const mainChannel = currentChannels.find(channel => 
        channel?.channel_name === 'Main' || channel?.title === 'Main'
    );
    const nonMainChannels = currentChannels
        .filter(channel => channel?.channel_name !== 'Main' && channel?.title !== 'Main')
        .sort((a, b) => {
            const dateA = new Date(a?.updated_at || 0);
            const dateB = new Date(b?.updated_at || 0);
            return dateB - dateA;
        });
    const orderedChannels = mainChannel
        ? [mainChannel, ...nonMainChannels]
        : nonMainChannels;

    if (!isChat) {
        const validFeedChannels = nonMainChannels.filter(channel => channel && typeof channel?.channel_id === 'string');
        const channelIdsForDnd = validFeedChannels.map(channel => channel?.channel_id);
        if (canReorder) {
            return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={channelIdsForDnd} strategy={verticalListSortingStrategy}>
                        <nav className="channel-list">
                            <p className="channel-header-text" style={{ margin: 0 }}>Channels</p>
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                            <ul>
                                {mainChannel && (
                                    <li key={mainChannel?.channel_id} className={`channel-item ${mainChannel?.channel_name === channel_name ? 'selected' : ''}`}>
                                        <Link to={isSaved ? `/saved/${mainChannel?.channel_name}` : `/${urlLetter}/${feedName}/${mainChannel?.channel_name}`}>
                                            <div className={`channel-link ${mainChannel?.channel_name === channel_name ? 'selected' : ''}`}>
                                                {mainChannel.channel_name}
                                            </div>
                                        </Link>
                                    </li>
                                )}
                                {validFeedChannels.map(channel => (
                                    <SortableFeedChannelItem
                                        key={channel?.channel_id}
                                        id={channel?.channel_id}
                                        channel={channel}
                                        url={isSaved ? `/saved/${channel?.channel_name}` : `/${urlLetter}/${feedName}/${channel?.channel_name}`}
                                    />
                                ))}
                            </ul>
                        </nav>
                    </SortableContext>
                </DndContext>
            );
        } else {
            return (
                <nav className="channel-list">
                    <p className="channel-header-text" style={{ margin: 0 }}>{isChat ? 'Chats' : 'Channels'}</p>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <ul>
                        {orderedChannels.map(channel => (
                            <li key={channel?.channel_id || channel?.channelId} 
                                className={`channel-item ${channel?.channel_name === channel_name ? 'selected' : ''}`}>
                                <Link to={`/${urlLetter}/${feedName}/${channel?.channel_name}`}>
                                    <div className={`channel-link ${channel?.channel_name === channel_name ? 'selected' : ''}`}>
                                        {channel?.channel_name}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            );
        }
    } else {
        return (
            <nav className="channel-list">
                <p className="channel-header-text" style={{ margin: 0 }}>{isChat ? 'Chats' : 'Channels'}</p>
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <ul>
                    {orderedChannels.map(channel => (
                        <li key={channel?.chat_id} className="channel-item">
                            <Link to={`/connections/${feedName}/${channel?.chat_id}`}>
                                <div className="channel-link">
                                    {channel?.title}
                                    {unreadState.chatCounts[channel?.chat_id] > 0 && (
                                        <span className="unread-count">
                                            {unreadState.chatCounts[channel?.chat_id]}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        );
    }
};

export default ChannelList;