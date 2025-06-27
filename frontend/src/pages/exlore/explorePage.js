import { useEffect, useState } from "react";
import axios from "axios";
import ExploreContentWidget from "../../components/explore/ExploreContentWidget";
import { Link, useOutletContext } from "react-router-dom";

const ExplorePage = () => {
  const [posts, setPosts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const { rightClasses } = useOutletContext();

  useEffect(() => {
    const fetchExploreData = async () => {
      setLoading(true);
      try {
        // Fetch random posts
        const postsRes = await axios.get("/api/explore_posts", {
          params: { limit: 9, filter },
        });
        console.log("Posts Response:", postsRes.data);
        setPosts(postsRes.data.posts || []);

        // Fetch random channels
        // const channelsRes = await axios.get("/api/explore_channels", {
        //   params: { limit: 6, filter },
        // });
        // setChannels(channelsRes.data.channels || []);
      } catch (err) {
        setPosts([]);
        // setChannels([]);
      }
      setLoading(false);
    };
    fetchExploreData();
  }, [filter]);

  return (
    <div className="flex flex-row h-screen bg-black text-white">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-6 text-center mt-1">Explore</h1>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <span className="text-xl text-gray-400">Loading...</span>
          </div>
        ) : (
          <>
            {/* Posts Grid */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Featured Posts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {posts.map((post) => (
                  <div
                    key={post.post_id}
                    className="bg-white rounded-xl shadow hover:shadow-lg transition p-4"
                  >
                    <Link to={`/d/${post.deep_feed_id}/${post.post_id}`}>
                      <ExploreContentWidget post={post} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            {/* Channels Grid */}
            {/* <div>
              <h2 className="text-2xl font-semibold mb-4">Featured Channels</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {channels.map((channel) => (
                  <Link
                    key={channel.channel_id}
                    to={`/${channel.is_group ? "g" : "u"}/${
                      channel.feed_name
                    }/${channel.channel_name}`}
                    className="block bg-white rounded-xl shadow hover:shadow-lg transition p-6 text-center"
                  >
                    <div className="text-lg font-bold text-blue-600 mb-2">
                      {channel.channel_name}
                    </div>
                    <div className="text-gray-500">{channel.feed_name}</div>
                  </Link>
                ))}
              </div>
            </div> */}
          </>
        )}
      </div>
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
