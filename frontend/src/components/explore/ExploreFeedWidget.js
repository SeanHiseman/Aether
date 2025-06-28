import React from "react";
import { Link } from "react-router-dom";

// Note: I removed the unused FollowerChangeButton and ManageConnectionButton imports
// to keep the component clean. You can add them back if needed.

const ExploreFeedWidget = ({ feed }) => {
  // A fallback for the image in case feed_photo is missing
  const imageUrl = feed.feed_photo
    ? `/${feed.feed_photo}`
    : "/media/site_images/blank-group-icon.jpg";

  return (
    <Link
      // The Link is now the main container for the card for better clickability
      to={`/${feed.is_group ? "g" : "u"}/${feed.feed_name}/Main`}
      className="block bg-gray-800 rounded-lg p-4 text-center transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl hover:bg-gray-700"
    >
      {/* Profile Image */}
      <div className="w-20 h-20 rounded-full overflow-hidden mb-4">
        <img
          className="w-full h-full object-cover"
          src={imageUrl}
          alt={`${feed.feed_name} profile`}
        />
      </div>

      {/* Text Content */}
      <div className="flex flex-col">
        {/* Feed Name */}
        <span
          className="font-bold text-white text-lg truncate"
          title={feed.feed_name}
        >
          {feed.feed_name}
        </span>

        {/* Follower Count */}
        <span className="text-gray-400 text-sm mt-1">
          {feed.follower_count.toLocaleString()} follower
          {feed.follower_count !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
};

export default ExploreFeedWidget;
