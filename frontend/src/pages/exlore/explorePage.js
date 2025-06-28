import { useEffect, useState, useCallback, useContext } from "react";
import { AuthContext } from "../../components/authContext";
import axios from "axios";
import ExploreContentWidget from "../../components/explore/ExploreContentWidget";
import ExploreFeedWidget from "../../components/explore/ExploreFeedWidget";
import { Link, useOutletContext } from "react-router-dom";
import { useInView } from "react-intersection-observer";

const ExplorePage = () => {
  // State for posts (unchanged)
  const [posts, setPosts] = useState([]);

  // --- State for Infinite Scroll Channels ---
  const [feeds, setFeeds] = useState([]);
  const [page, setPage] = useState(1); // <-- Track the current page for channels
  const [hasMore, setHasMore] = useState(true); // <-- Track if more channels are available
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // <-- Separate loading state for subsequent fetches
  const { isAuthenticated, user, viewer } = useContext(AuthContext);
  const [filter, setFilter] = useState("all");
  const { rightClasses } = useOutletContext();

  // --- Intersection Observer for the trigger element ---
  // `ref` will be attached to a loader element at the bottom of the list.
  // `inView` will be true when that element is visible on screen.
  const { ref, inView } = useInView({
    threshold: 0.5, // Trigger when 50% of the loader is visible
  });

  // --- Reusable function to fetch feeds ---
  const fetchFeeds = useCallback(async () => {
    if (loadingMore || !hasMore) return; // Don't fetch if already fetching or no more data

    setLoadingMore(true);
    try {
      const res = await axios.get("/api/explore_feeds", {
        params: { limit: 6, page: page }, // <-- Send the current page number
      });

      // Append new feeds to the existing list, not replace them
      setFeeds((prevFeeds) => [...prevFeeds, ...res.data.feeds]);

      // Update hasMore based on the API response
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error("Failed to fetch feeds", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  // --- useEffect to fetch INITIAL data (posts and first page of channels) ---
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch posts (this logic remains the same)
        const postsRes = await axios.get("/api/explore_posts", {
          params: { limit: 6, filter },
        });
        setPosts(postsRes.data.posts || []);

        // Reset and fetch first page of channels when filter changes
        setFeeds([]);
        setPage(1);
        setHasMore(true);
        // We'll let the second useEffect handle the actual first fetch
      } catch (err) {
        setPosts([]);
        setFeeds([]);
      }
      setLoading(false);
    };
    fetchInitialData();
  }, [filter]); // Re-run only when filter changes

  // --- useEffect to fetch MORE channels when the trigger is in view ---
  useEffect(() => {
    // If the loader element is in view, we have more data to fetch, and we're not already loading
    if (inView && hasMore && !loading) {
      // Increment the page number to fetch the next set of data
      setPage((prevPage) => prevPage + 1);
    }
  }, [inView, hasMore, loading]);

  // --- useEffect to actually call the fetch function when page changes ---
  useEffect(() => {
    if (page > 0) {
      // page is initialized to 1
      fetchFeeds();
    }
  }, [page, fetchFeeds]); // depends on page and the memoized fetch function

  return (
    <div className="flex flex-row h-screen bg-black text-white">
      {/* Main Content */}
      <h1 className="text-4xl font-bold mb-6 text-center mt-1">Explore</h1>
      {/* <div className="flex-1 p-6 pt-24 overflow-y-auto min-w-0">
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="text-xl text-gray-400">Loading...</span>
          </div>
        ) : (
          <> */}
      {/* Posts Grid */}
      {/* <div>
              <h2 className="text-2xl font-semibold mb-4">Featured Posts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {posts.map((post) => (
                  <div
                    key={post.post_id}
                    className="bg-gray-800 rounded-xl shadow hover:shadow-lg transition p-4"
                  >
                    <Link to={`/d/${post.deep_feed_id}/${post.post_id}`}>
                      <ExploreContentWidget post={post} />
                    </Link>
                  </div>
                ))}
              </div>
            </div> */}

      {/* Channels Grid with Infinite Scroll */}
      {/* <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {feeds.map((feed) => (

                  <ExploreFeedWidget
                    key={feed.feed_id}
                    feed={feed}
                    isAuthenticated={isAuthenticated}
                    viewerId={viewer?.feed_id}
                  />
                ))}
              </div> */}

      {/* --- The Trigger Element --- */}
      {/* This element will trigger the next fetch when it becomes visible */}
      {/* {hasMore && (
                <div ref={ref} className="flex justify-center items-center p-8">
                  <span className="text-xl text-gray-400">
                    {loadingMore ? "Loading more..." : ""}
                  </span>
                </div>
              )}

              {!hasMore && feeds.length > 0 && (
                <div className="text-center text-gray-500 p-8">
                  You've reached the end!
                </div>
              )}
            </div>
          </>
        )}
      </div> */}

      {/* Right Sidebar (Filters) */}
      <aside className={`${rightClasses} w-80 bg-white`}>
        <h3 className="text-xl font-semibold mb-4">Filters</h3>
        <div className="flex flex-col gap-3 text-black">
          <button
            className={`py-2 px-4 rounded ${
              filter === "all" ? "bg-blue-500 text-white" : "bg-gray-100"
            }`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`py-2 px-4 rounded ${
              filter === "posts" ? "bg-blue-500 text-white" : "bg-gray-100"
            }`}
            onClick={() => setFilter("posts")}
          >
            Posts Only
          </button>
          <button
            className={`py-2 px-4 rounded ${
              filter === "channels" ? "bg-blue-500 text-white" : "bg-gray-100"
            }`}
            onClick={() => setFilter("channels")}
          >
            Channels Only
          </button>
        </div>
      </aside>
    </div>
  );
};

export default ExplorePage;
