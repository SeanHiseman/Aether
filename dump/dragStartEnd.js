    const dragStart = event => {
        const { active } = event;
        const activeIdLocal = active.id;
        let dragTypeLocal = "feed";
        let dragItemLocal = null;
        const parentDeepFeedId = active.data.current?.parentDeepFeedId || null;
        if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("df-item-")) {
            dragTypeLocal = "feedInDeepFeed";
            const feedId = activeIdLocal.replace("df-item-", "");
            const parentDeepFeed = deepFeeds.find(df => df.deep_feed_id === parentDeepFeedId);
            if (parentDeepFeed?.feeds) {
                const content = parentDeepFeed.feeds.find(item => item.feed?.feed_id === feedId);
                if (content) {
                    dragItemLocal = { feed: content.feed, parentDeepFeedId };
                } else {
                    for (const df of deepFeeds) {
                        const fallback = df.feeds?.find(item => item.feed?.feed_id === feedId);
                        if (fallback) {
                            dragItemLocal = { feed: fallback.feed, parentDeepFeedId: df.deep_feed_id };
                            break;
                        }
                    }
                }
            }
        }
        else if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("df-")) {
            dragTypeLocal = "deepFeed";
            const deepFeedId = activeIdLocal.replace("df-", "");
            dragItemLocal = deepFeeds.find(df => df.deep_feed_id === deepFeedId);
        }
        else if (typeof activeIdLocal === "string" && activeIdLocal.startsWith("nested-df-")) {
            dragTypeLocal = "nestedDeepFeed";
            if (active.data.current?.nestedDeepFeed) {
                dragItemLocal = {
                    nestedDeepFeed: active.data.current.nestedDeepFeed,
                    parentDeepFeedId
                };
            } else {
                dragItemLocal = null;
            }
        }
        else {
            dragItemLocal = feeds.find(f => f.feed_id.toString() === activeIdLocal);
        }
        if (!dragItemLocal && dragTypeLocal === "feedInDeepFeed") {
            const feedId = activeIdLocal.replace("df-item-", "");
            const feedFromAll = feeds.find(f => f.feed_id.toString() === feedId);
            if (feedFromAll) {
                dragItemLocal = {
                    feed: {
                        feed_id: feedFromAll.feed_id,
                        feed_name: feedFromAll.followedFeed?.feed_name,
                        feed_photo: feedFromAll.followedFeed?.feed_photo,
                        is_group: feedFromAll.link_type === "g"
                    },
                    parentDeepFeedId
                };
            }
        }
        setDragType(dragTypeLocal);
        setActiveDragItem(dragItemLocal);
        setActiveId(activeIdLocal);
    };

    const dragEnd = async event => {
        const { active, over } = event;
        if (!over) {
            if (dragType === "feedInDeepFeed" && activeDragItem) {
                try {
                    const payload = {
                        deepFeedId: activeDragItem.parentDeepFeedId,
                        feedId: activeDragItem.feed.feed_id
                    };
                    const { data } = await axios.post("/api/remove_from_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[activeDragItem.parentDeepFeedId]) {
                        deepFeedCallbacks[activeDragItem.parentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                }
                catch {
                    setAsideErrorMessage("Error removing from Deep Feed");
                    setTimeout(() => setAsideErrorMessage(""), 5000);
                }
            }
            else if (dragType === "nestedDeepFeed" && activeDragItem) {
                try {
                    const payload = {
                        deepFeedId: activeDragItem.parentDeepFeedId,
                        nestedDeepFeedId: activeDragItem.nestedDeepFeed.deep_feed_id
                    };
                    const { data } = await axios.post("/api/remove_from_deep_feed", payload);
                    if (data.success && deepFeedCallbacks[activeDragItem.parentDeepFeedId]) {
                        deepFeedCallbacks[activeDragItem.parentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                    }
                }
                catch {
                    setAsideErrorMessage("Error removing nested deep feed");
                    setTimeout(() => setAsideErrorMessage(""), 5000);
                }
            }
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        const activeIdLocal = active.id;
        const overId = over.id;
        if (activeIdLocal === overId) {
            setActiveId(null);
            setActiveDragItem(null);
            setDragType(null);
            return;
        }
        try {
            const sourceParentDeepFeedId = active.data.current?.parentDeepFeedId;
            const targetParentDeepFeedId = over.data.current?.parentDeepFeedId;
            // Case 1: two feeds combine into a new deep feed
            if (
                dragType === "feed"
                && typeof overId === "string"
                && !overId.startsWith("df-")
                && !overId.startsWith("df-item-")
                && !sourceParentDeepFeedId
            ) {
                const sourceFeed = feeds.find(f => f.feed_id.toString() === activeIdLocal);
                const destFeed = feeds.find(f => f.feed_id.toString() === overId);
                if (sourceFeed && destFeed) {
                    const deepFeedName = prompt("Enter deep feed name:");
                    if (deepFeedName) {
                        const payload = {
                            viewerId: viewer.feed_id,
                            deepFeedName,
                            feedsToInclude: [sourceFeed.feed_id, destFeed.feed_id]
                        };
                        const { data } = await axios.post("/api/create_deep_feed", payload);
                        if (data.success && data.deepFeed) {
                            const newDeep = {
                                ...data.deepFeed,
                                feeds: data.feedsToInclude.map(id => ({ feed: feeds.find(f => f.feed_id === id) }))
                            };
                            setDeepFeeds(prev => [...prev, newDeep]);
                            navigate(`/d/${data.deepFeed.deep_feed_id}`);
                        }
                    }
                }
            }
            // Case 2: feed → existing deep feed
            else if (
                dragType === "feed"
                && typeof overId === "string"
                && overId.startsWith("df-")
                && !sourceParentDeepFeedId
            ) {
                const sourceFeed = feeds.find(f => f.feed_id.toString() === activeIdLocal);
                if (sourceFeed) {
                    try {
                        const payload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: sourceFeed.feed_id,
                            nestedDeepFeedId: null
                        };
                        const { data } = await axios.post("/api/add_to_deep_feed", payload);
                        if (data.success) {
                            if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                deepFeedCallbacks[targetParentDeepFeedId](sourceFeed.followedFeed);
                            }
                            else {
                                setAsideErrorMessage("Error updating feep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error updating deep feed");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
            // Case 3: two feeds inside same deep feed → nested deep feed
            else if (
                dragType === "feedInDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-item-")
                && sourceParentDeepFeedId === targetParentDeepFeedId
            ) {
                const sourceFeedId = activeDragItem.feed.feed_id;
                const destFeedId = overId.replace("df-item-", "");
                if (sourceFeedId !== destFeedId) {
                    const deepFeedName = prompt("Enter deep feed name:");
                    if (deepFeedName) {
                        try {
                            const payload = {
                                viewerId: viewer.feed_id,
                                deepFeedName,
                                feedsToInclude: [sourceFeedId, destFeedId],
                                parentDeepFeedId: sourceParentDeepFeedId
                            };
                            const { data } = await axios.post("/api/create_deep_feed", payload);
                            if (data.success && data.deepFeed) {
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                                setDeepFeeds(prev => prev.map(df => {
                                    if (df.deep_feed_id === sourceParentDeepFeedId) {
                                        const filtered = (df.feeds || []).filter(item =>
                                            !(item.feed && (item.feed.feed_id === sourceFeedId || item.feed.feed_id === destFeedId))
                                        );
                                        return {
                                            ...df,
                                            feeds: [
                                                ...filtered,
                                                { nestedDeepFeed: data.deepFeed }
                                            ]
                                        };
                                    }
                                    return df;
                                }));
                            }
                        }
                        catch {
                            setAsideErrorMessage("Error creating nested Deep Feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                }
            }
            // Case 4: move feed from one deep feed to another
            else if (
                dragType === "feedInDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-")
            ) {
                const sourceFeedId = activeDragItem.feed.feed_id;
                if (sourceParentDeepFeedId !== targetParentDeepFeedId) {
                    try {
                        const addPayload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: sourceFeedId,
                            nestedDeepFeedId: null
                        };
                        const { data: addData } = await axios.post("/api/add_to_deep_feed", addPayload);
                        if (addData.success) {
                            const removePayload = {
                                deepFeedId: sourceParentDeepFeedId,
                                feedId: sourceFeedId
                            };
                            const { data: removeData } = await axios.post("/api/remove_from_deep_feed", removePayload);
                            if (removeData.success) {
                                if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                    deepFeedCallbacks[targetParentDeepFeedId](activeDragItem.feed);
                                }
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                            }
                            else {
                                setAsideErrorMessage("Error removing feed from deep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                        else {
                            setAsideErrorMessage("Error adding feed to deep feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error moving feed between deep feeds");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
            // Case 5: move nested deep feed to another deep feed
            else if (
                dragType === "nestedDeepFeed"
                && typeof overId === "string"
                && overId.startsWith("df-")
            ) {
                const nestedDeepFeedId = activeDragItem.nestedDeepFeed.deep_feed_id;
                if (sourceParentDeepFeedId !== targetParentDeepFeedId) {
                    try {
                        const addPayload = {
                            deepFeedId: targetParentDeepFeedId,
                            feedId: null,
                            nestedDeepFeedId
                        };
                        const { data: addData } = await axios.post("/api/add_to_deep_feed", addPayload);
                        if (addData.success) {
                            const removePayload = {
                                deepFeedId: sourceParentDeepFeedId,
                                nestedDeepFeedId
                            };
                            const { data: removeData } = await axios.post("/api/remove_from_deep_feed", removePayload);
                            if (removeData.success) {
                                if (deepFeedCallbacks[targetParentDeepFeedId]) {
                                    deepFeedCallbacks[targetParentDeepFeedId]({
                                        type: "ADD_NESTED_DEEP_FEED",
                                        nestedDeepFeed: activeDragItem.nestedDeepFeed
                                    });
                                }
                                if (deepFeedCallbacks[sourceParentDeepFeedId]) {
                                    deepFeedCallbacks[sourceParentDeepFeedId]({ type: "UPDATE_CONTENTS" });
                                }
                            }
                            else {
                                setAsideErrorMessage("Error removing deep feed");
                                setTimeout(() => setAsideErrorMessage(""), 5000);
                            }
                        }
                        else {
                            setAsideErrorMessage("Error adding deep feed");
                            setTimeout(() => setAsideErrorMessage(""), 5000);
                        }
                    }
                    catch {
                        setAsideErrorMessage("Error moving deep feed");
                        setTimeout(() => setAsideErrorMessage(""), 5000);
                    }
                }
            }
        }
        catch {
            setAsideErrorMessage("Error in drag operation");
        }
        setActiveId(null);
        setActiveDragItem(null);
        setDragType(null);
    };