import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FaCompress, FaExpand, FaPlus, FaMinus } from 'react-icons/fa';
import axios from 'axios';

const ReplyTreeView = ({ replies, onReplyClick, renderReplyContent }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [replyNodes, setReplyNodes] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  
  useEffect(() => {
    const initialReplyNodes = {};
    replies.forEach(reply => {
      initialReplyNodes[reply.post_id] = {
        reply,
        children: [],  
        position: { x: 0, y: 0 },
        expanded: false,
        hasMoreReplies: reply.replies > 0, 
        loadedReplies: false 
      };
    });
    replies.forEach(reply => {
      if (reply.parent_id) {
        if (initialReplyNodes[reply.parent_id]) {
          initialReplyNodes[reply.parent_id].children.push(reply.post_id);
        }
      }
    });
    const topLevelReplies = replies.filter(reply => 
      !reply.parent_id || !initialReplyNodes[reply.parent_id]
    );
    const spacing = 300;
    topLevelReplies.forEach((reply, index) => {
      initialReplyNodes[reply.post_id].position = { 
        x: index * spacing, 
        y: 50 
      };
    });
    setReplyNodes(initialReplyNodes);
  }, [replies]);

  const fetchRepliesForNode = async (replyId) => {
    try {
      setLoadingReplies(prev => ({ ...prev, [replyId]: true }));
      const response = await axios.get(`/api/post_replies/${replyId}`);
      const newReplies = response.data;
      setReplyNodes(prev => {
        const updatedNodes = { ...prev };
        newReplies.forEach(reply => {
          if (!updatedNodes[reply.post_id]) {
            updatedNodes[reply.post_id] = {
              reply,
              children: [],
              position: { x: 0, y: 0 },
              expanded: false,
              hasMoreReplies: reply.replies > 0,
              loadedReplies: false
            };
          }
        });
        newReplies.forEach(reply => {
          if (reply.parent_id && updatedNodes[reply.parent_id]) {
            // Only add to children if not already there
            if (!updatedNodes[reply.parent_id].children.includes(reply.post_id)) {
              updatedNodes[reply.parent_id].children.push(reply.post_id);
            }
          }
        });
        if (updatedNodes[replyId]) {
          updatedNodes[replyId].loadedReplies = true;
        }
        return updatedNodes;
      });
      setLoadingReplies(prev => {
        const updated = { ...prev };
        delete updated[replyId];
        return updated;
      });
      return true;
    } catch (error) {
      setLoadingReplies(prev => {
        const updated = { ...prev };
        delete updated[replyId];
        return updated;
      });
      return false;
    }
  };

  const handleMouseDown = (e) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const relativeX = (mouseX - position.x) / scale;
    const relativeY = (mouseY - position.y) / scale;
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1; 
    const newScale = Math.max(0.3, Math.min(3, scale * scaleFactor));
    const newPosition = {
      x: mouseX - relativeX * newScale,
      y: mouseY - relativeY * newScale
    };
    setScale(newScale);
    setPosition(newPosition);
  };

  const zoomIn = () => {
    const container = containerRef.current;
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const relativeX = (centerX - position.x) / scale;
    const relativeY = (centerY - position.y) / scale;
    const newScale = Math.min(scale + 0.2, 3);
    const newPosition = {
      x: centerX - relativeX * newScale,
      y: centerY - relativeY * newScale
    };
    setScale(newScale);
    setPosition(newPosition);
  };

  const zoomOut = () => {
    const container = containerRef.current;
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const relativeX = (centerX - position.x) / scale;
    const relativeY = (centerY - position.y) / scale;
    const newScale = Math.max(scale - 0.2, 0.3);
    const newPosition = {
      x: centerX - relativeX * newScale,
      y: centerY - relativeY * newScale
    };
    setScale(newScale);
    setPosition(newPosition);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleReplyExpansion = async (replyId) => {
    const node = replyNodes[replyId];
    if (node.expanded) {
      setReplyNodes(prev => {
        const updatedNodes = { ...prev };
        updatedNodes[replyId].expanded = false;
        return updatedNodes;
      });
      return;
    }
    if (node.hasMoreReplies && !node.loadedReplies) {
      const success = await fetchRepliesForNode(replyId);
      if (!success) return; 
      setReplyNodes(prev => {
        const updatedNodes = { ...prev };
        updatedNodes[replyId].expanded = true;
        const childrenIds = updatedNodes[replyId].children;
        const parentPos = updatedNodes[replyId].position;
        childrenIds.forEach((childId, index) => {
          const spacing = 300;
          const offset = (childrenIds.length - 1) * spacing / 2;
          updatedNodes[childId].position = {
            x: parentPos.x - offset + index * spacing,
            y: parentPos.y + 150
          };
          if (updatedNodes[childId].expanded) {
            positionChildNodes(childId, updatedNodes, 1);
          }
        });
        return updatedNodes;
      });
    }
  };
  
  const positionChildNodes = (parentId, nodes, depth) => {
    const childrenIds = nodes[parentId].children;
    const parentPos = nodes[parentId].position;
    childrenIds.forEach((childId, index) => {
      const spacing = 300 / (depth * 0.8 + 1); 
      const offset = (childrenIds.length - 1) * spacing / 2;
      nodes[childId].position = {
        x: parentPos.x - offset + index * spacing,
        y: parentPos.y + 150
      };
      if (nodes[childId].expanded) {
        positionChildNodes(childId, nodes, depth + 1);
      }
    });
  };

  const drawConnections = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2 * scale;
    Object.keys(replyNodes).forEach(replyId => {
      const node = replyNodes[replyId];
      if (node.expanded) {
        node.children.forEach(childId => {
          const childNode = replyNodes[childId];
          if (childNode) {
            ctx.beginPath();
            const startX = node.position.x + position.x + 125; //Center of node
            const startY = node.position.y + position.y + 50; //Bottom of node
            const endX = childNode.position.x + position.x + 125; //Center of child node
            const endY = childNode.position.y + position.y; //Top of child node
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(
              startX, startY + 50,
              endX, endY - 50,
              endX, endY
            );
            ctx.stroke();
          }
        });
      }
    });
  };

  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.offsetWidth;
        canvasRef.current.height = containerRef.current.offsetHeight;
        drawConnections();
      }
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [containerRef, canvasRef, replyNodes, position, scale]);

  useEffect(() => {
    drawConnections();
  }, [position, scale, replyNodes]);

  return (
    <div className="reply-tree-container" ref={containerRef} onWheel={handleWheel}>
      <canvas className="reply-tree-canvas" ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} />
      <div className="tree-nodes-container" style={{ transform: `scale(${scale})` }}>
        {Object.keys(replyNodes).map(replyId => {
          const node = replyNodes[replyId];
          const hasChildren = node.children.length > 0;
          const hasUnloadedReplies = node.hasMoreReplies && !node.loadedReplies;
          const showExpandButton = hasChildren || hasUnloadedReplies;
          const isLoading = loadingReplies[replyId];
          return (
            <div key={replyId} className="reply-node" style={{ left: `${node.position.x + position.x}px`, top: `${node.position.y + position.y}px`}}>
              {renderReplyContent(node.reply)}
              {showExpandButton && (
                <button className="expand-reply-btn" onClick={() => toggleReplyExpansion(replyId)} disabled={isLoading}>
                  {isLoading ? '...' : node.expanded ? '-' : hasChildren ? `+${node.children.length}` : `+${node.reply.replies}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="tree-controls" style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 10 }}>
        <button onClick={zoomIn} className="control-btn" title="Zoom In">
          <FaPlus />
        </button>
        <button onClick={zoomOut} className="control-btn" title="Zoom Out">
          <FaMinus />
        </button>
        <button onClick={resetView} className="control-btn" title="Reset View">
          <FaCompress />
        </button>
      </div>
    </div>
  );
};

ReplyTreeView.propTypes = {
  replies: PropTypes.array.isRequired,
  onReplyClick: PropTypes.func.isRequired,
  renderReplyContent: PropTypes.func.isRequired
};

export default ReplyTreeView;