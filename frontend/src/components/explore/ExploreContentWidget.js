import React from "react";

const ExploreContentWidget = ({ post }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-2">
        <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
        <p className="text-gray-500 text-sm mb-1">
          by{" "}
          <span className="font-semibold">
            {post.poster?.feed_name || "Unknown"}
          </span>
        </p>
      </div>
      <div className="flex-1">
        <p className="text-gray-800 line-clamp-4">{post.content}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Views: {post.views}</span>
        <span>Upvotes: {post.upvotes ?? post.votes?.upvotes ?? 0}</span>
        <span>Replies: {post.replies}</span>
      </div>
    </div>
  );
};

export default ExploreContentWidget;
