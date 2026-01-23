import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';

const ExternalFollowItem = ({ follow, parentDeepFeedId, platform = 'bluesky' }) => {
    const navigate = useNavigate();
    const [isDragIntent, setIsDragIntent] = useState(false);
    const [mouseDown, setMouseDown] = useState(false);

    const uniqueId = parentDeepFeedId
        ? `df-${parentDeepFeedId}-${platform}-${follow?.did}`
        : `sidebar-${platform}-${follow?.did}`;

    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: uniqueId,
        data: {
            parentDeepFeedId,
            type: platform === 'bluesky' ? 'blueskyFollow' : 'externalFollow',
            platform: platform,
            follow: follow,
            originalId: follow?.did
        }
    });

    const setNodeRef = (element) => {
        setDraggableRef(element);
        setDroppableRef(element);
    };
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: uniqueId, disabled: !!parentDeepFeedId });

    const style = {
        cursor: isDragging ? 'grabbing' : mouseDown ? 'grab' : 'pointer',
        opacity: isDragging ? 0.8 : 1,
        position: 'relative',
        touchAction: 'none',
        transform: CSS.Translate.toString(transform),
        transition: 'none',
        zIndex: isDragging ? 1000 : 1,
    };

    const handleClick = useCallback((e) => {
        if (!isDragIntent && !isDragging) {
            //Navigate to internal page to view this account's posts
            //Pass follow data through state so name/avatar show immediately
            navigate(`/external/${platform}/${encodeURIComponent(follow?.did || follow?.handle)}`, {
                state: {
                    accountInfo: {
                        did: follow?.did,
                        handle: follow?.handle,
                        display_name: follow?.display_name || follow?.displayName,
                        avatar: follow?.avatar,
                        description: follow?.description
                    }
                }
            });
        }
    }, [isDragIntent, isDragging, follow, navigate, platform]);

    const handleMouseDown = useCallback(() => {
        setIsDragIntent(false);
    }, []);

    const handleMouseMove = useCallback(() => {
        setIsDragIntent(true);
    }, []);

    React.useEffect(() => {
        if (!isDragging) {
            setIsDragIntent(false);
        }
    }, [isDragging]);

    const displayName = follow?.display_name || follow?.handle;
    const avatarUrl = follow?.avatar || '/media/site_images/blank-profile.png';

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`feed-list-item bluesky-follow-item ${isDragging ? 'dragging' : ''} ${isOver && !parentDeepFeedId ? 'drop-target' : ''}`}
            data-parent-deep-feed-id={parentDeepFeedId}
        >
            <div
                className="feed-list-link-container"
                {...attributes}
                {...listeners}
                onMouseDown={(e) => { setMouseDown(true); handleMouseDown(e); listeners?.onMouseDown?.(e); }}
                onMouseUp={(e) => { setMouseDown(false); listeners?.onMouseUp?.(e); }}
                onMouseLeave={() => setMouseDown(false)}
                onMouseMove={handleMouseMove}
                onClick={handleClick}
            >
                <div className="feed-list-link">
                    <img
                        className="small-feed-photo"
                        src={avatarUrl}
                        onError={(e) => e.currentTarget.src = '/media/site_images/blank-profile.png'}
                        draggable={false}
                        alt={displayName}
                    />
                    <p className="small-text">{displayName}</p>
                    <img
                        className="bluesky-indicator"
                        src={`/media/site_images/social_sites/${platform}-logo.png`}
                        alt={platform.charAt(0).toUpperCase() + platform.slice(1)}
                        title={`${platform.charAt(0).toUpperCase() + platform.slice(1)} follow`}
                    />
                </div>
            </div>
        </li>
    );
};

export default ExternalFollowItem;