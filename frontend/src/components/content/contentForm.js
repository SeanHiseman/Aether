import axios from 'axios'
import React, { useEffect, useState, useCallback } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { v4 } from 'uuid'
import ContentDisplay from './contentDisplay'
import PropTypes from 'prop-types'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

const BLOCK_TYPES = {
  CODE: 'CODE',
  MEDIA: 'MEDIA',
  TEXT: 'TEXT',
}

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

const compileBlocksToHTML = (blocks) => {
  return blocks
    .map((block) => {
      if (block.type === BLOCK_TYPES.TEXT) {
        return block.data.html || ''
      } else if (block.type === BLOCK_TYPES.CODE) {
        return `<div class="code-block">${block.data.code}</div>`
      } else if (block.type === BLOCK_TYPES.MEDIA) {
        const fileType = block.data?.file?.type || ''
        const mediaUrl = block.data.url || `/media/${block.data.file.filename}`
        if (fileType.startsWith('image/')) {
          return `<img src="${mediaUrl}" alt="Uploaded image" />`
        } else if (fileType.startsWith('video/')) {
          return `<video controls><source src="${mediaUrl}" type="${fileType}"></video>`
        }
      }
      return ''
    })
    .join('\n')
}

const ContentForm = ({ isEdit = false, isReply, onSubmit, post = null, setShowForm }) => {
  const [blocks, setBlocks] = useState([])
  const [formErrorMessage, setFormErrorMessage] = useState('')
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const MAX_FILE_SIZE = 10 * 1024 * 1024
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (isEdit && post) {
      setTitle(post.title || '')
      if (post.is_code) {
        setBlocks([
          {
            id: v4(),
            type: BLOCK_TYPES.CODE,
            data: { code: post.content },
            isEditing: true,
          },
        ])
      } else {
        setBlocks([
          {
            id: v4(),
            type: BLOCK_TYPES.TEXT,
            data: { html: post.content },
            isEditing: true,
          },
        ])
      }
    }
  }, [isEdit, post])

  const handleAddBlock = useCallback(
    (type) => {
      const newBlock = {
        id: v4(),
        type,
        data:
          type === BLOCK_TYPES.TEXT
            ? { html: '' }
            : type === BLOCK_TYPES.CODE
            ? { code: '' }
            : { file: null, url: '' },
        isEditing: type !== BLOCK_TYPES.MEDIA,
      }
      setBlocks((prev) => [...prev, newBlock])
    },
    [setBlocks]
  )

  const moveBlockUp = useCallback(
    (index) => {
      if (index === 0) return
      setBlocks((prev) => {
        const newBlocks = [...prev]
        ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
        return newBlocks
      })
    },
    [setBlocks]
  )

  const moveBlockDown = useCallback(
    (index) => {
      if (index === blocks.length - 1) return
      setBlocks((prev) => {
        const newBlocks = [...prev]
        ;[newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]]
        return newBlocks
      })
    },
    [blocks.length, setBlocks]
  )

  const removeBlock = useCallback(
    (blockId) => {
      setBlocks((prev) => prev.filter((block) => block.id !== blockId))
    },
    [setBlocks]
  )

  const updateBlock = useCallback(
    (updatedBlock) => {
      setBlocks((prevBlocks) =>
        prevBlocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
      )
    },
    [setBlocks]
  )

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
          request: prompt,
        })
        if (response.data && response.status === 201) {
          const { generatedContent } = response.data
          const updated = {
            ...block,
            data: { ...block.data, code: generatedContent },
          }
          updateBlock(updated)
        } else {
          setFormErrorMessage('Creation error.')
        }
      } catch (error) {
        setFormErrorMessage('Error creating content.')
      } finally {
        setIsLoadingAI(false)
      }
    },
    [isEdit, post, updateBlock]
  )

  const createUniqueFilename = (originalName) => {
    const ext = originalName.substring(originalName.lastIndexOf('.'))
    return `${Date.now()}-${v4()}${ext}`
  }

  const handleFilesChange = useCallback(
    (event) => {
      const newFiles = Array.from(event.target.files)
      const oversizedFiles = newFiles.filter((file) => file.size > MAX_FILE_SIZE)
      if (oversizedFiles.length > 0) {
        const oversizedNames = oversizedFiles.map((file) => file.name).join(', ')
        setFormErrorMessage(`These files exceed 10MB: ${oversizedNames}`)
        return
      }
      setFormErrorMessage('')
      const uniqueFiles = newFiles.map((file) => {
        const uniqueFilename = createUniqueFilename(file.name)
        return new File([file], uniqueFilename, { type: file.type })
      })
      const newMediaBlocks = uniqueFiles.map((file) => ({
        id: v4(),
        type: BLOCK_TYPES.MEDIA,
        data: {
          file,
          url: URL.createObjectURL(file),
        },
        isEditing: false,
      }))
      setBlocks((prev) => [...prev, ...newMediaBlocks])
    },
    [setBlocks]
  )

  const handleOverflowChange = useCallback(() => {}, [])

  const onDragEnd = (result) => {
    const { destination, source } = result
    if (!destination) {
      return
    }
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }
    const reorderedBlocks = reorder(blocks, source.index, destination.index)
    setBlocks(reorderedBlocks)
  }

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!blocks.length) {
        setFormErrorMessage('At least one block is required.')
        return
      }
      const finalHTML = compileBlocksToHTML(blocks)
      if (!finalHTML.trim()) {
        setFormErrorMessage('Content cannot be empty.')
        return
      }
      try {
        setFormErrorMessage('')
        const formData = new FormData()
        const postId = v4()
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
      } catch (error) {
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
            id="title-entry"
            type="text"
            placeholder="Add title (optional)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
          />
        )}
        <div className="action-buttons">
          <button
            className="button"
            type="button"
            onClick={() => setShowForm(false)}
          >
            Close
          </button>
          <button className="button" type="submit">
            {isEdit ? 'Save Edit' : isReply ? 'Reply' : 'Post'}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)}
          >
            + Text
          </button>
          <button
            type="button"
            className="button"
            onClick={() => handleAddBlock(BLOCK_TYPES.CODE)}
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
        {formErrorMessage && (
          <div className="error-message">{formErrorMessage}</div>
        )}
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
                    const { id, type, data, isEditing } = block
                    const toggleEdit = () => {
                      updateBlock({ ...block, isEditing: !isEditing })
                    }
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            className={`block ${snapshot.isDragging ? 'dragging' : ''}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <div className="block-controls">
                              <button
                                type="button"
                                onClick={() => moveBlockUp(index)}
                                className="control-button"
                                title="Move Up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlockDown(index)}
                                className="control-button"
                                title="Move Down"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(id)}
                                className="control-button remove-button"
                                title="Remove"
                              >
                                ✕
                              </button>
                              {type !== BLOCK_TYPES.MEDIA && (
                                <button
                                  type="button"
                                  onClick={toggleEdit}
                                  className="control-button edit-button"
                                  title={isEditing ? 'Close Editor' : 'Edit'}
                                >
                                  {isEditing ? '🔒' : '✎'}
                                </button>
                              )}
                            </div>
                            <div className="block-content">
                              {type === BLOCK_TYPES.TEXT && (
                                isEditing ? (
                                  <ReactQuill
                                    theme="snow"
                                    value={data.html}
                                    onChange={(val) => {
                                      updateBlock({ ...block, data: { ...data, html: val } })
                                    }}
                                    className="text-editor"
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
                                        onChange={(e) => {
                                          updateBlock({
                                            ...block,
                                            data: { ...data, _tempAiPrompt: e.target.value },
                                          })
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateCodeBlock(block)}
                                        className={
                                          isLoadingAI
                                            ? 'dark-button generate disabled'
                                            : 'dark-button generate'
                                        }
                                        disabled={isLoadingAI}
                                      >
                                        {isLoadingAI ? 'Creating...' : 'Create'}
                                      </button>
                                    </div>
                                    <textarea
                                      className="code-input"
                                      value={data.code}
                                      onChange={(e) => {
                                        updateBlock({
                                          ...block,
                                          data: { ...data, code: e.target.value },
                                        })
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <pre className="code-preview">
                                    {data.code}
                                  </pre>
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
            <h3>Preview</h3>
            <ContentDisplay
              content={compileBlocksToHTML(blocks)}
              onOverflowChange={handleOverflowChange}
              showFullContent
              showScrollBar={false}
            />
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
  setShowForm: PropTypes.func.isRequired,
}

export default ContentForm





