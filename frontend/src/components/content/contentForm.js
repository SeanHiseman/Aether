import axios from 'axios'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useState } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { v4 as uuidv4 } from 'uuid'

const BLOCK_TYPES = {
  CODE: 'CODE',
  MEDIA: 'MEDIA',
  TEXT: 'TEXT'
}

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

const ContentForm = ({ isEdit = false, isReply, onSubmit, post = null, setShowForm }) => {
  const [blocks, setBlocks] = useState([])
  const [formErrorMessage, setFormErrorMessage] = useState('')
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [title, setTitle] = useState('')
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  useEffect(() => {
    if (isEdit && post) {
      setTitle(post.title || '')
      if (post.is_code) {
        setBlocks([
          {
            data: { code: post.content },
            id: uuidv4(),
            isEditing: true,
            type: BLOCK_TYPES.CODE
          }
        ])
      } else {
        setBlocks([
          {
            data: { html: post.content },
            id: uuidv4(),
            isEditing: true,
            type: BLOCK_TYPES.TEXT
          }
        ])
      }
    }
  }, [isEdit, post])

  const handleAddBlock = useCallback((type) => {
    const newBlock = {
      data:
        type === BLOCK_TYPES.TEXT
          ? { html: '' }
          : type === BLOCK_TYPES.CODE
          ? { code: '' }
          : { file: null, url: '' },
      id: uuidv4(),
      isEditing: type !== BLOCK_TYPES.MEDIA,
      type
    }
    setBlocks((prev) => [...prev, newBlock])
  }, [])

  const moveBlockUp = useCallback((index) => {
    if (index === 0) return
    setBlocks((prev) => {
      const newBlocks = [...prev]
      ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
      return newBlocks
    })
  }, [])

  const moveBlockDown = useCallback((index) => {
    if (index === blocks.length - 1) return
    setBlocks((prev) => {
      const newBlocks = [...prev]
      ;[newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]]
      return newBlocks
    })
  }, [blocks.length])

  const removeBlock = useCallback((blockId) => {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId))
  }, [])

  const updateBlock = useCallback((updatedBlock) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    )
  }, [])

  const onDragEnd = useCallback((result) => {
    const { destination, source } = result
    if (!destination) return
    if (destination.index === source.index) return
    const reordered = reorder(blocks, source.index, destination.index)
    setBlocks(reordered)
  }, [blocks])

  const handleGenerateCodeBlock = useCallback(
    async (block) => {
      try {
        const prompt = block.data._tempAiPrompt || ''
        if (!prompt.trim()) {
          setFormErrorMessage('Prompt cannot be empty.')
          return
        }
        setIsLoadingAI(true)
        setFormErrorMessage('')
        const response = await axios.post('/api/generate_content', {
          currentCode: block.data.code,
          parentCode: isEdit && post ? post.content : null,
          request: prompt
        })
        if (response.data && response.status === 201) {
          const { generatedContent } = response.data
          updateBlock({
            ...block,
            data: { ...block.data, code: generatedContent }
          })
        } else {
          setFormErrorMessage('Creation error.')
        }
      } catch {
        setFormErrorMessage('Error creating content.')
      } finally {
        setIsLoadingAI(false)
      }
    },
    [isEdit, post, updateBlock]
  )

  const createUniqueFilename = (originalName) => {
    const ext = originalName.substring(originalName.lastIndexOf('.'))
    return `${Date.now()}-${uuidv4()}${ext}`
  }

  const handleFilesChange = useCallback((event) => {
    const newFiles = Array.from(event.target.files)
    const oversizedFiles = newFiles.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map((f) => f.name).join(', ')
      setFormErrorMessage(`These files exceed 10MB: ${names}`)
      return
    }
    setFormErrorMessage('')
    const uniqueFiles = newFiles.map((file) => {
      const uniqueFilename = createUniqueFilename(file.name)
      return new File([file], uniqueFilename, { type: file.type })
    })
    const newMediaBlocks = uniqueFiles.map((file) => ({
      data: { file, url: URL.createObjectURL(file) },
      id: uuidv4(),
      isEditing: false,
      type: BLOCK_TYPES.MEDIA
    }))
    setBlocks((prev) => [...prev, ...newMediaBlocks])
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!blocks.length) {
        setFormErrorMessage('At least one block is required.')
        return
      }
      let finalHTML = ''
      blocks.forEach((block) => {
        if (block.type === BLOCK_TYPES.TEXT) {
          finalHTML += `<div class="content-block">${block.data.html || ''}</div>`
        } else if (block.type === BLOCK_TYPES.CODE) {
          finalHTML += `<div class="content-block">${block.data.code}</div>`
        } else if (block.type === BLOCK_TYPES.MEDIA) {
          const fileType = block.data.file?.type || ''
          if (fileType.startsWith('image/')) {
            finalHTML += `
              <div class="content-block">
                <img
                  src="${block.data.url}"
                  alt="Uploaded image"
                  style="max-width:100%;height:auto;"
                />
              </div>`
          } else if (fileType.startsWith('video/')) {
            finalHTML += `
              <div class="content-block">
                <video controls style="max-width:100%;height:auto;">
                  <source src="${block.data.url}" type="${fileType}" />
                </video>
              </div>`
          }
        }
      })
      try {
        setFormErrorMessage('')
        const formData = new FormData()
        const postId = uuidv4()
        formData.append('post_id', postId)
        formData.append('content', finalHTML)
        if (isReply && post) {
          formData.append('parent_id', post.post_id)
        }
        if (!isReply) {
          formData.append('title', title)
        }
        blocks
          .filter((b) => b.type === BLOCK_TYPES.MEDIA && b.data.file)
          .forEach((mediaBlock) => {
            formData.append('files', mediaBlock.data.file)
          })
        await onSubmit(formData)
        setTitle('')
        setBlocks([])
      } catch {
        setFormErrorMessage('Error submitting the form.')
      }
    },
    [blocks, isReply, onSubmit, post, title]
  )

  return (
    <div className="create-post-container">
      <form id="post-form" onSubmit={handleSubmit} className="post-form">
        {!isReply && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            id="title-entry"
            className="title-input"
            placeholder="Add title (optional)..."
          />
        )}
        <div className="action-buttons">
          <button type="button" onClick={() => setShowForm(false)} className="button">
            Close
          </button>
          <button type="submit" className="button">
            {isEdit ? 'Save Edit' : isReply ? 'Reply' : 'Post'}
          </button>
          <button
            type="button"
            onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)}
            className="button"
          >
            + Text
          </button>
          <button
            type="button"
            onClick={() => handleAddBlock(BLOCK_TYPES.CODE)}
            className="button"
          >
            + Custom content
          </button>
          <label htmlFor="media-input" className="button media-button">
            + Media
          </label>
          <input
            type="file"
            id="media-input"
            accept="image/*,video/*"
            hidden
            multiple
            onChange={handleFilesChange}
          />
        </div>
        {formErrorMessage && <div className="error-message">{formErrorMessage}</div>}
        <div className="main-content">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="blocks-droppable">
              {(provided) => (
                <div
                  className="blocks-container"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {blocks.map((block, index) => {
                    const { data, id, isEditing, type } = block
                    const toggleEdit = () => {
                      updateBlock({ ...block, isEditing: !isEditing })
                    }
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(provided2, snapshot) => (
                          <div
                            ref={provided2.innerRef}
                            {...provided2.draggableProps}
                            {...provided2.dragHandleProps}
                            className={`block ${snapshot.isDragging ? 'dragging' : ''}`}
                          >
                            <div className="block-controls">
                              <button
                                type="button"
                                title="Move Up"
                                onClick={() => moveBlockUp(index)}
                                className="control-button"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                title="Move Down"
                                onClick={() => moveBlockDown(index)}
                                className="control-button"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                title="Remove"
                                onClick={() => removeBlock(id)}
                                className="control-button remove-button"
                              >
                                ✕
                              </button>
                              {type !== BLOCK_TYPES.MEDIA && (
                                <button
                                  type="button"
                                  title={isEditing ? 'Close Editor' : 'Edit'}
                                  onClick={toggleEdit}
                                  className="control-button edit-button"
                                >
                                  {isEditing ? '🔒' : '✎'}
                                </button>
                              )}
                            </div>
                            <div className="block-content">
                              {type === BLOCK_TYPES.TEXT && (
                                isEditing ? (
                                  <ReactQuill
                                    className="text-editor"
                                    theme="snow"
                                    value={data.html}
                                    onChange={(val) =>
                                      updateBlock({ ...block, data: { ...data, html: val } })
                                    }
                                  />
                                ) : (
                                  <div
                                    className="text-preview"
                                    dangerouslySetInnerHTML={{ __html: data.html }}
                                  />
                                )
                              )}
                              {type === BLOCK_TYPES.CODE && (
                                isEditing ? (
                                  <div className="code-editor-container">
                                    <div className="ai-generator">
                                      <textarea
                                        placeholder="Describe your content..."
                                        className="ai-prompt"
                                        onChange={(e) =>
                                          updateBlock({
                                            ...block,
                                            data: { ...data, _tempAiPrompt: e.target.value }
                                          })
                                        }
                                      />
                                      <button
                                        type="button"
                                        className={
                                          isLoadingAI
                                            ? 'dark-button generate disabled'
                                            : 'dark-button generate'
                                        }
                                        disabled={isLoadingAI}
                                        onClick={() => handleGenerateCodeBlock(block)}
                                      >
                                        {isLoadingAI ? 'Creating...' : 'Create'}
                                      </button>
                                    </div>
                                    <textarea
                                      className="code-input"
                                      value={data.code}
                                      onChange={(e) =>
                                        updateBlock({ ...block, data: { ...data, code: e.target.value } })
                                      }
                                    />
                                  </div>
                                ) : (
                                  <iframe
                                    sandbox="allow-scripts allow-same-origin"
                                    style={{
                                      border: 'none',
                                      width: '100%'
                                    }}
                                    srcDoc={data.code}
                                    title={`code-preview-${id}`}
                                  />
                                )
                              )}
                              {type === BLOCK_TYPES.MEDIA && (
                                <div className="media-preview">
                                  {data.file.type.startsWith('image/') ? (
                                    <img src={data.url} alt="Uploaded Media" />
                                  ) : data.file.type.startsWith('video/') ? (
                                    <video src={data.url} controls />
                                  ) : (
                                    <p>Unsupported media type</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="live-preview-container">
            <p className="text24" style={{marginLeft: 0}}>Preview</p>
            {blocks.map((block, i) => {
              if (block.type === BLOCK_TYPES.TEXT) {
                return (
                  <div
                    key={i}
                    dangerouslySetInnerHTML={{ __html: block.data.html }}
                  />
                )
              } else if (block.type === BLOCK_TYPES.CODE) {
                return (
                  <div key={i}>
                    <iframe
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        border: 'none',
                        width: '100%'
                      }}
                      srcDoc={block.data.code}
                      title={`live-preview-${i}`}
                    />
                  </div>
                )
              } else if (block.type === BLOCK_TYPES.MEDIA) {
                const fileType = block.data.file?.type || ''
                if (fileType.startsWith('image/')) {
                  return (
                    <div key={i}>
                      <img
                        src={block.data.url}
                        alt="Uploaded Media"
                        style={{ maxWidth: '100%', height: 'auto' }}
                      />
                    </div>
                  )
                } else if (fileType.startsWith('video/')) {
                  return (
                    <div key={i}>
                      <video controls style={{ maxWidth: '100%', height: 'auto' }}>
                        <source src={block.data.url} type={fileType} />
                      </video>
                    </div>
                  )
                }
              }
              return null
            })}
          </div>
        </div>
      </form>
    </div>
  )
}

ContentForm.propTypes = {
  isEdit: PropTypes.bool,
  isReply: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  post: PropTypes.object,
  setShowForm: PropTypes.func.isRequired
}

export default ContentForm;













