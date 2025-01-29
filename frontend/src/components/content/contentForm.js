import axios from 'axios';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';

const BLOCK_TYPES = {
  CODE: 'CODE',
  MEDIA: 'MEDIA',
  TEXT: 'TEXT',
};

const parseContentBlocks = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const divs = doc.querySelectorAll('div.content-block');
  const blocks = [];
  divs.forEach((div) => {
    const blockClass = div.className;
    const blockId = div.getAttribute('data-blockid');
    const content = div.innerHTML.trim();
    if (blockClass.includes('code-block')) {
      const iframe = div.querySelector('iframe');
      const srcDoc = iframe ? iframe.getAttribute('srcdoc') : '';
      blocks.push({
        data: { code: srcDoc || '' },
        id: blockId,
        isEditing: false,
        type: BLOCK_TYPES.CODE,
      });
    } else if (blockClass.includes('text-block')) {
      blocks.push({
        data: { html: content },
        id: blockId,
        isEditing: false,
        type: BLOCK_TYPES.TEXT,
      });
    } else if (blockClass.includes('media-block')) {
      const img = div.querySelector('img');
      const video = div.querySelector('video');
      if (img) {
        blocks.push({
          data: {
            file: null,
            fileType: 'image/*',
            isImage: true,
            isVideo: false,
            url: img.getAttribute('src'),
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        });
      } else if (video) {
        const source = video.querySelector('source');
        blocks.push({
          data: {
            file: null,
            fileType: source ? source.getAttribute('type') : '',
            isImage: false,
            isVideo: true,
            url: source ? source.getAttribute('src') : '',
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        });
      } else {
        blocks.push({
          data: {
            file: null,
            fileType: '',
            isImage: false,
            isVideo: false,
            url: '',
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        });
      }
    }
  });
  return blocks;
};

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const getIframeSrcDoc = (code, blockId) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; }}
        </style>
      </head>
      <body>
        ${code}
        <script>
          function sendHeight() {
            const height = document.body.scrollHeight;
            parent.postMessage({ blockId: '${blockId}', height: height }, '*');
          }
          window.addEventListener('load', sendHeight);
          window.addEventListener('resize', sendHeight);
          const observer = new MutationObserver(sendHeight);
          observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        </script>
      </body>
    </html>
  `;
};

const escapeHtml = (html) => {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const ContentForm = ({ isEdit = false, isReply, onSubmit, post = null, setShowForm }) => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const [blocks, setBlocks] = useState([]);
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const iframeRefs = useRef({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [title, setTitle] = useState('');
  const [globalAiPrompt, setGlobalAiPrompt] = useState('');

  useEffect(() => {
    if (isEdit && post) {
      setTitle(post.title || '');
      const existingBlocks = parseContentBlocks(post.content || '');
      setBlocks(
        existingBlocks.length
          ? existingBlocks
          : [
              {
                data: { html: post.content },
                id: uuidv4(),
                isEditing: true,
                type: BLOCK_TYPES.TEXT,
              },
            ]
      );
    }
  }, [isEdit, post]);

  useEffect(() => {
    const handleIframeMessage = (event) => {
      const { blockId, height } = event.data;
      if (blockId && height) {
        const iframe = iframeRefs.current[blockId];
        if (iframe) {
          iframe.style.height = `${height}px`;
        }
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);

  const handleAddBlock = useCallback((type) => {
    const newBlock = {
      data:
        type === BLOCK_TYPES.TEXT
          ? { html: '' }
          : type === BLOCK_TYPES.CODE
          ? { code: '' }
          : {
              file: null,
              fileType: '',
              isImage: false,
              isVideo: false,
              url: '',
            },
      id: uuidv4(),
      isEditing: type !== BLOCK_TYPES.MEDIA,
      type,
    };
    setBlocks((prev) => [...prev, newBlock]);
  }, []);

  const handleFilesChange = useCallback((event) => {
    const newFiles = Array.from(event.target.files);
    const oversizedFiles = newFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map((f) => f.name).join(', ');
      setFormErrorMessage(`These files exceed 10MB: ${names}`);
      return;
    }
    setFormErrorMessage('');
    const uniqueFiles = newFiles.map((file) => {
      const ext = file.name.substring(file.name.lastIndexOf('.'));
      const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
      return new File([file], uniqueName, { type: file.type });
    });
    const newMediaBlocks = uniqueFiles.map((file) => {
      const fileType = file.type;
      return {
        data: {
          file,
          fileType,
          isImage: fileType.startsWith('image/'),
          isVideo: fileType.startsWith('video/'),
          url: URL.createObjectURL(file),
        },
        id: uuidv4(),
        isEditing: false,
        type: BLOCK_TYPES.MEDIA,
      };
    });
    setBlocks((prev) => [...prev, ...newMediaBlocks]);
  }, []);

  const moveBlockDown = useCallback(
    (index) => {
      if (index === blocks.length - 1) return;
      setBlocks((prev) => {
        const newBlocks = [...prev];
        [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
        return newBlocks;
      });
    },
    [blocks.length]
  );

  const moveBlockUp = useCallback((index) => {
    if (index === 0) return;
    setBlocks((prev) => {
      const newBlocks = [...prev];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      return newBlocks;
    });
  }, []);

  const removeBlock = useCallback((blockId) => {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId));
    if (iframeRefs.current[blockId]) {
      delete iframeRefs.current[blockId];
    }
  }, []);

  const updateBlock = useCallback((updatedBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));
  }, []);

  const onDragEnd = useCallback(
    (result) => {
      const { destination, source } = result;
      if (!destination) return;
      if (destination.index === source.index) return;
      const reordered = reorder(blocks, source.index, destination.index);
      setBlocks(reordered);
    },
    [blocks]
  );

  const handleGenerateCodeBlock = useCallback(
    async (block) => {
      try {
        const prompt = block.data._tempAiPrompt || '';
        if (!prompt.trim()) {
          setFormErrorMessage('Prompt cannot be empty.');
          return;
        }
        setIsLoadingAI(true);
        setFormErrorMessage('');
        const response = await axios.post('/api/generate_content', {
          currentCode: block.data.code,
          parentCode: isEdit && post ? post.content : null,
          request: prompt,
        });
        if (response.data && response.status === 201) {
          const { generatedContent } = response.data;
          updateBlock({
            ...block,
            data: { ...block.data, code: generatedContent },
            isEditing: false,
          });
        } else {
          setFormErrorMessage('Creation error.');
        }
      } catch {
        setFormErrorMessage('Error creating content.');
      } finally {
        setIsLoadingAI(false);
      }
    },
    [isEdit, post, updateBlock]
  );

  const compileFinalHTML = useCallback((allBlocks) => {
    let finalHTML = '';
    allBlocks.forEach((block) => {
      if (block.type === BLOCK_TYPES.TEXT) {
        finalHTML += `<div class="content-block text-block" data-blockid="${block.id}">${block.data.html || ''}</div>`;
      } else if (block.type === BLOCK_TYPES.CODE) {
        const srcDocContent = getIframeSrcDoc(block.data.code, block.id);
        const escapedSrcDoc = escapeHtml(srcDocContent);
        finalHTML += `<div class="content-block code-block" data-blockid="${block.id}"><iframe sandbox="allow-scripts allow-same-origin" srcdoc="${escapedSrcDoc}" style="border: none; width: 100%; height: 0px;" title="code-preview-${block.id}"></iframe></div>`;
      } else if (block.type === BLOCK_TYPES.MEDIA) {
        if (block.data.isImage) {
          finalHTML += `<div class="content-block media-block" data-blockid="${block.id}"><img src="${block.data.url}" alt="Uploaded image" style="max-width:100%;height:auto;" /></div>`;
        } else if (block.data.isVideo) {
          finalHTML += `<div class="content-block media-block" data-blockid="${block.id}"><video controls style="max-width:100%;height:auto;"><source src="${block.data.url}" type="${block.data.fileType}" /></video></div>`;
        } else {
          finalHTML += `<div class="content-block media-block" data-blockid="${block.id}">Unsupported</div>`;
        }
      }
    });
    return finalHTML;
  }, []);

  const handleGenerateFullContent = useCallback(async () => {
    try {
      const prompt = globalAiPrompt.trim();
      if (!prompt) {
        setFormErrorMessage('Prompt cannot be empty.');
        return;
      }
      setIsLoadingAI(true);
      setFormErrorMessage('');
      const fullHTML = compileFinalHTML(blocks);
      const response = await axios.post('/api/generate_content', {
        currentCode: fullHTML,
        parentCode: isEdit && post ? post.content : null,
        request: prompt,
      });
      if (response.data && response.status === 201) {
        const { generatedContent } = response.data;
        const newBlocks = parseContentBlocks(generatedContent || '');
        setBlocks(newBlocks.length ? newBlocks : blocks);
      } else {
        setFormErrorMessage('Creation error.');
      }
    } catch {
      setFormErrorMessage('Error creating content.');
    } finally {
      setIsLoadingAI(false);
    }
  }, [blocks, compileFinalHTML, globalAiPrompt, isEdit, post]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!blocks.length) {
        setFormErrorMessage('At least one block is required.');
        return;
      }
      const finalHTML = compileFinalHTML(blocks);
      try {
        setFormErrorMessage('');
        const formData = new FormData();
        if (!isEdit) {
          const postId = uuidv4();
          formData.append('post_id', postId);
        }
        formData.append('content', finalHTML);
        if (isReply && post) {
          formData.append('parent_id', post.post_id);
        }
        if (!isReply) {
          formData.append('title', title);
        }
        blocks
          .filter((b) => b.type === BLOCK_TYPES.MEDIA && b.data.file)
          .forEach((mediaBlock) => {
            formData.append('files', mediaBlock.data.file);
          });
        await onSubmit(formData);
        setTitle('');
        setBlocks([]);
        setGlobalAiPrompt('');
      } catch {
        setFormErrorMessage('Error submitting the form.');
      }
    },
    [blocks, compileFinalHTML, isEdit, isReply, onSubmit, post, title]
  );

  return (
    <div className="create-post-container">
      <form className="post-form" id="post-form" onSubmit={handleSubmit}>
        {!isReply && (
          <input
            className="title-input"
            id="title-entry"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title (optional)..."
            type="text"
            value={title}
          />
        )}
        <div className="action-buttons">
          <button className="button" onClick={() => setShowForm(false)} type="button">
            Close
          </button>
          <button className="button" type="submit">
            {isEdit ? 'Save Edit' : isReply ? 'Reply' : 'Post'}
          </button>
          <button className="button" onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)} type="button">
            + Text
          </button>
          <label className="button media-button" htmlFor="media-input">
            + Media
          </label>
          <button className="button" onClick={() => handleAddBlock(BLOCK_TYPES.CODE)} type="button">
            + Custom
          </button>
          <input
            accept="image/*,video/*"
            hidden
            id="media-input"
            multiple
            onChange={handleFilesChange}
            type="file"
          />
        </div>
        {formErrorMessage && <div className="error-message">{formErrorMessage}</div>}
        <div className="main-content">
          <div className="shared-container">
            <div className="global-ai-prompt-container">
              <textarea
                onChange={(e) => setGlobalAiPrompt(e.target.value)}
                placeholder="Describe changes for entire post..."
                value={globalAiPrompt}
              />
              <button
                className={isLoadingAI ? 'button generate disabled' : 'button generate'}
                disabled={isLoadingAI}
                onClick={handleGenerateFullContent}
                type="button"
              >
                {isLoadingAI ? 'Creating...' : 'Create'}
              </button>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="blocks-droppable">
                {(provided) => (
                  <div className="blocks-container" ref={provided.innerRef} {...provided.droppableProps}>
                    {blocks.map((block, index) => {
                      const { data, id, isEditing, type } = block;
                      const toggleEdit = () => {
                        updateBlock({ ...block, isEditing: !isEditing });
                      };
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(provided2) => (
                            <div
                              className="block"
                              ref={provided2.innerRef}
                              {...provided2.draggableProps}
                              {...provided2.dragHandleProps}
                            >
                              <div className="block-controls">
                                <button className="control-button" onClick={() => moveBlockUp(index)} type="button">
                                  ↑
                                </button>
                                <button className="control-button" onClick={() => moveBlockDown(index)} type="button">
                                  ↓
                                </button>
                                <button
                                  className="control-button remove-button"
                                  onClick={() => removeBlock(id)}
                                  type="button"
                                >
                                  ✕
                                </button>
                                {type !== BLOCK_TYPES.MEDIA && (
                                  <button className="control-button edit-button" onClick={toggleEdit} type="button">
                                    {isEditing ? '🔒' : '✎'}
                                  </button>
                                )}
                              </div>
                              <div className="block-content">
                                {type === BLOCK_TYPES.TEXT &&
                                  (isEditing ? (
                                    <ReactQuill
                                      className="text-editor"
                                      onChange={(val) =>
                                        updateBlock({
                                          ...block,
                                          data: { ...data, html: val },
                                        })
                                      }
                                      theme="snow"
                                      value={data.html}
                                    />
                                  ) : (
                                    <div className="text-preview" dangerouslySetInnerHTML={{ __html: data.html }} />
                                  ))}
                                {type === BLOCK_TYPES.CODE &&
                                  (isEditing ? (
                                    <div className="code-editor-container">
                                      <div className="ai-generator">
                                        <textarea
                                          className="ai-prompt"
                                          onChange={(e) =>
                                            updateBlock({
                                              ...block,
                                              data: { ...data, _tempAiPrompt: e.target.value },
                                            })
                                          }
                                          placeholder="Describe your content..."
                                        />
                                        <button
                                          className={
                                            isLoadingAI ? 'dark-button generate disabled' : 'dark-button generate'
                                          }
                                          disabled={isLoadingAI}
                                          onClick={() => handleGenerateCodeBlock(block)}
                                          type="button"
                                        >
                                          {isLoadingAI ? 'Creating...' : 'Create'}
                                        </button>
                                      </div>
                                      <textarea
                                        className="code-input"
                                        onChange={(e) =>
                                          updateBlock({
                                            ...block,
                                            data: { ...data, code: e.target.value },
                                          })
                                        }
                                        value={data.code}
                                      />
                                    </div>
                                  ) : (
                                    <iframe
                                      ref={(el) => {
                                        iframeRefs.current[id] = el;
                                      }}
                                      sandbox="allow-scripts allow-same-origin"
                                      srcDoc={getIframeSrcDoc(data.code, id)}
                                      style={{ border: 'none', width: '100%', height: '0px' }}
                                      title={`code-preview-${id}`}
                                    />
                                  ))}
                                {type === BLOCK_TYPES.MEDIA && (
                                  <div className="media-preview">
                                    {data.isImage ? (
                                      <img alt="Uploaded Media" src={data.url} />
                                    ) : data.isVideo ? (
                                      <video controls src={data.url} />
                                    ) : (
                                      <p>Unsupported</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Live Preview Container */}
          <div className="live-preview-container">
            <p className="text24" style={{ marginLeft: 0, marginTop: 0 }}>
              Preview
            </p>
            {blocks.map((block, i) => {
              if (block.type === BLOCK_TYPES.TEXT) {
                return <div dangerouslySetInnerHTML={{ __html: block.data.html }} key={i} />;
              } else if (block.type === BLOCK_TYPES.CODE) {
                return (
                  <div key={i}>
                    <iframe
                      ref={(el) => {
                        iframeRefs.current[block.id] = el;
                      }}
                      sandbox="allow-scripts allow-same-origin"
                      srcDoc={getIframeSrcDoc(block.data.code, block.id)}
                      style={{ border: 'none', width: '100%', height: '0px' }}
                      title={`live-preview-${i}`}
                    />
                  </div>
                );
              } else if (block.type === BLOCK_TYPES.MEDIA) {
                if (block.data.isImage) {
                  return (
                    <div key={i}>
                      <img alt="Uploaded Media" src={block.data.url} style={{ maxWidth: '100%', height: 'auto' }} />
                    </div>
                  );
                } else if (block.data.isVideo) {
                  return (
                    <div key={i}>
                      <video controls style={{ maxWidth: '100%', height: 'auto' }}>
                        <source src={block.data.url} type={block.data.fileType} />
                      </video>
                    </div>
                  );
                }
                return <p key={i}>Unsupported</p>;
              }
              return null;
            })}
          </div>
        </div>
      </form>
    </div>
  );
};

ContentForm.propTypes = {
  isEdit: PropTypes.bool,
  isReply: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  post: PropTypes.object,
  setShowForm: PropTypes.func.isRequired,
};

export default ContentForm;





