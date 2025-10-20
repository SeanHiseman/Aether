import api from '../../api';
import { CSS } from '@dnd-kit/utilities'; 
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../components/authContext';
import { decrypt } from '../../encryptionUtil';
import { UnreadContext } from '../messages/unreadContext';

const SortableFeedChannelItem = ({ channel, id, url }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, cursor: 'grab' };

    return (
        <li ref={setNodeRef} style={style} className={`channel-item ${isDragging ? 'dragging-active' : ''}`}  {...attributes}  {...listeners} >
            <Link to={url} style={{ pointerEvents: isDragging ? 'none' : 'auto' }} >
                <div className="channel-link">{channel.channel_name}</div>
            </Link>
        </li>
    );
};

const ChannelList = ({ canReorder = false, channels, feedId, feedName, isChat, isGroup, isSaved, setChannels }) => {
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
                const response = await api.get(`/get_chats/${viewer.feed_id}`, {
                    params: { connectionName: feedName }
                });
                if (response.data.success) {
                    const decryptedChats = response.data?.chats.map((chat) => {
                        return {
                            ...chat,
                            title: decrypt(chat.title)
                        };
                    });
                    setChannels(decryptedChats || []);
                } else {
                    setErrorMessage(response.data?.message || 'Error getting chats from API');
                    setChannels([]);
                }
            }
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error getting channels');
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
                distance: 5, //Only start dragging after moving 5px
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (isChat || !active || !over || active.id === over.id) {
            return; 
        }
        const oldIndex = channels.findIndex(c => c.channel_id === active.id);
        const newIndex = channels.findIndex(c => c.channel_id === over.id);
        if (oldIndex === -1 || newIndex === -1) {
            return;
        }
        const reorderedChannels = arrayMove(channels, oldIndex, newIndex);
        setChannels(reorderedChannels);
        const orderedChannelIds = reorderedChannels.map(channel => channel.channel_id);
        try {
            await api.put('/reorder_feed_channels', {
                feed_id: feedId,
                orderedChannelIds: orderedChannelIds
            });
        } catch (error) {
            setErrorMessage(error.response.data?.message || 'Error saving order');
            setTimeout(() => { setErrorMessage(''); }, 5000);
            getFeedChannels(); 
        }
    };

    const currentChannels = Array.isArray(channels) ? channels : [];

    if (!isChat) {
        const validFeedChannels = currentChannels.filter(channel => channel && typeof channel?.channel_id === 'string');
        const channelIdsForDnd = validFeedChannels.map(channel => channel?.channel_id);
        if (canReorder) {
            return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={channelIdsForDnd} strategy={verticalListSortingStrategy}>
                        <nav className="channel-list">
                            {errorMessage && <div className="error-message">{errorMessage}</div>}
                            <ul>
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
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <ul>
                        {currentChannels.map(channel => (
                            <li key={channel?.channel_id || channel?.channelId} className="channel-item">
                                <Link to={`/${urlLetter}/${feedName}/${channel?.channel_name}`}>
                                    <div className="channel-link">{channel?.channel_name}</div>
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
                {errorMessage && <div className="error-message">{errorMessage}</div>}
                <ul>
                    {currentChannels.map(channel => (
                        <li key={channel?.chat_id} className="channel-item">
                            <Link to={`/connections/${feedName}/${channel?.title}`}>
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