import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FaArrowDown, FaArrowRight, FaArrowUp, FaCircleNotch, FaCommentAlt, FaEdit, FaEye, FaFont, FaPhotoVideo, FaPlus, FaReply, FaSave, FaTerminal, FaTimes, FaToolbox, FaWindowClose, FaAlignCenter } from 'react-icons/fa'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { v4 as uuidv4 } from 'uuid'
import ContentWidget from './contentWidget'

const BLOCK_TYPES = {
  CODE: 'CODE',
  MEDIA: 'MEDIA',
  TEXT: 'TEXT',
}

const escapeHtml = (html) =>
  html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const parseContentBlocks = (htmlString) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  const divs = doc.querySelectorAll('div.content-block')
  const result = []
  divs.forEach((div) => {
    const blockClass = div.className
    const blockId = div.getAttribute('data-blockid')
    const content = div.innerHTML.trim()
    if (blockClass.includes('code-block')) {
      const code = div.getAttribute('data-code') || ''
      result.push({
        data: { code, isBlockLoading: false, showPrompt: true },
        id: blockId,
        isEditing: false,
        type: BLOCK_TYPES.CODE,
      })
    } else if (blockClass.includes('text-block')) {
      result.push({
        data: { html: content },
        id: blockId,
        isEditing: false,
        type: BLOCK_TYPES.TEXT,
      })
    } else if (blockClass.includes('media-block')) {
      const img = div.querySelector('img')
      const video = div.querySelector('video')
      const align = div.getAttribute('data-align') || 'left'
      if (img) {
        result.push({
          data: {
            file: null,
            fileType: 'image/*',
            isImage: true,
            isVideo: false,
            url: img.getAttribute('src'),
            align,
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        })
      } else if (video) {
        const source = video.querySelector('source')
        result.push({
          data: {
            file: null,
            fileType: source ? source.getAttribute('type') : '',
            isImage: false,
            isVideo: true,
            url: source ? source.getAttribute('src') : '',
            align,
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        })
      } else {
        result.push({
          data: {
            file: null,
            fileType: '',
            isImage: false,
            isVideo: false,
            url: '',
            align,
          },
          id: blockId,
          isEditing: false,
          type: BLOCK_TYPES.MEDIA,
        })
      }
    }
  })
  return result
}

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

const ContentForm = ({
  feed,
  isEdit = false,
  isGroup,
  isReply,
  onSubmit,
  post = null,
  setShowForm,
}) => {
  const [blocks, setBlocks] = useState([])
  const [editMode, setEditMode] = useState(true)
  const [formErrorMessage, setFormErrorMessage] = useState('')
  const [globalAiPrompt, setGlobalAiPrompt] = useState('')
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [title, setTitle] = useState('')
  const iframeRefs = useRef({})
  const { channel_name, feed_name } = useParams()
  const navigate = useNavigate()
  const urlPrefix = isGroup ? 'g' : 'u'
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const isContentEmpty = useCallback(
    (blocksArray) =>
      !blocksArray.some((block) => {
        if (block.type === BLOCK_TYPES.TEXT) {
          return block.data.html && block.data.html.trim() !== ''
        }
        if (block.type === BLOCK_TYPES.CODE) {
          return block.data.code && block.data.code.trim() !== ''
        }
        if (block.type === BLOCK_TYPES.MEDIA) {
          return block.data.url && block.data.url.trim() !== ''
        }
        return false
      }),
    []
  )

  useEffect(() => {
    if (isEdit && post) {
      setTitle(post.title || '')
      const existingBlocks = parseContentBlocks(post.content || '')
      if (existingBlocks.length) {
        setBlocks(existingBlocks)
      } else {
        setBlocks([
          {
            data: { html: post.content },
            id: uuidv4(),
            isEditing: true,
            type: BLOCK_TYPES.TEXT,
          },
        ])
      }
    }
  }, [isEdit, post])

  useEffect(() => {
    if (!isEdit) {
      setBlocks([
        {
          data: { html: '' },
          id: uuidv4(),
          isEditing: true,
          type: BLOCK_TYPES.TEXT,
        },
      ])
    }
  }, [isEdit])

  const handleIframeMessage = useCallback((event) => {
    const { blockId, height } = event.data
    if (blockId && height) {
      const iframe = iframeRefs.current[blockId]
      if (iframe) {
        iframe.style.height = `${height}px`
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleIframeMessage)
    return () => window.removeEventListener('message', handleIframeMessage)
  }, [handleIframeMessage])

  const getIframeSrcDoc = useCallback((id, code) => {
    const trimmedCode = code.trim()
    const scriptToInject = `<script>
      function sendHeight() {
        var newHeight = document.documentElement.scrollHeight;
        parent.postMessage({ blockId: '${id}', height: newHeight }, '*');
      }
      window.addEventListener('load', sendHeight);
      var observer = new MutationObserver(sendHeight);
      observer.observe(document.body, {childList:true, subtree:true, characterData:true});
      sendHeight();
      </script>`
    let srcDoc = ''
    if (/<html[\s>]/i.test(trimmedCode)) {
      if (/<\/body>/i.test(trimmedCode)) {
        srcDoc = trimmedCode.replace(/<\/body>/i, scriptToInject + '</body>')
      } else {
        srcDoc = trimmedCode + scriptToInject
      }
    } else {
      srcDoc = `<!DOCTYPE html>
        <html>
        <head>
        <style>html,body { margin:0; padding:0; }</style>
        </head>
        <body>
        <div id="content">${code}</div>
        ${scriptToInject}
        </body>
        </html>`
    }
    return srcDoc
  }, [])

  const handleAddBlock = useCallback((type) => {
    const newBlock = {
      data:
        type === BLOCK_TYPES.TEXT
          ? { html: '' }
          : type === BLOCK_TYPES.CODE
          ? { code: '', isBlockLoading: false, showPrompt: true }
          : { file: null, fileType: '', isImage: false, isVideo: false, url: '', align: 'left' },
      id: uuidv4(),
      isEditing: type !== BLOCK_TYPES.MEDIA,
      type,
    }
    setBlocks((prev) => [...prev, newBlock])
  }, [])

  const handleFilesChange = useCallback(
    (event) => {
      const files = Array.from(event.target.files)
      const oversized = files.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length) {
        const names = oversized.map((f) => f.name).join(', ')
        setFormErrorMessage(`These files exceed 10MB: ${names}`)
        return
      }
      setFormErrorMessage('')
      const uniqueFiles = files.map((file) => {
        const ext = file.name.substring(file.name.lastIndexOf('.'))
        const uniqueName = `${Date.now()}-${uuidv4()}${ext}`
        return new File([file], uniqueName, { type: file.type })
      })
      const mediaBlocks = uniqueFiles.map((file) => ({
        data: {
          file,
          fileType: file.type,
          isImage: file.type.startsWith('image/'),
          isVideo: file.type.startsWith('video/'),
          url: URL.createObjectURL(file),
          align: 'left',
        },
        id: uuidv4(),
        isEditing: false,
        type: BLOCK_TYPES.MEDIA,
      }))
      setBlocks((prev) => [...prev, ...mediaBlocks])
    },
    [MAX_FILE_SIZE]
  )

  const moveBlockDown = useCallback(
    (index) => {
      if (index === blocks.length - 1) return
      setBlocks((prev) => {
        const updated = [...prev]
        ;[updated[index + 1], updated[index]] = [updated[index], updated[index + 1]]
        return updated
      })
    },
    [blocks.length]
  )

  const moveBlockUp = useCallback((index) => {
    if (index === 0) return
    setBlocks((prev) => {
      const updated = [...prev]
      ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
      return updated
    })
  }, [])

  const removeBlock = useCallback((blockId) => {
    setBlocks((prev) => prev.filter((block) => block.id !== blockId))
    if (iframeRefs.current[blockId]) {
      delete iframeRefs.current[blockId]
    }
  }, [])

  const updateBlock = useCallback((updatedBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)))
  }, [])

  const onDragEnd = useCallback((result) => {
    const { destination, source } = result
    if (!destination) return
    if (destination.index === source.index) return
    setBlocks((prev) => reorder(prev, source.index, destination.index))
  }, [])

  const compileFinalHTML = useCallback((allBlocks) => {
    let finalHTML = ''
    allBlocks
      .filter((block) => {
        if (block.type === BLOCK_TYPES.TEXT) {
          return block.data.html && block.data.html.trim() !== ''
        }
        if (block.type === BLOCK_TYPES.CODE) {
          return block.data.code && block.data.code.trim() !== ''
        }
        if (block.type === BLOCK_TYPES.MEDIA) {
          return block.data.url && block.data.url.trim() !== ''
        }
        return false
      })
      .forEach((block) => {
        if (block.type === BLOCK_TYPES.TEXT) {
          finalHTML += `<div class="content-block text-block" data-blockid="${block.id}">${block.data.html || 'Nothing to preview'}</div>`
        } else if (block.type === BLOCK_TYPES.CODE) {
          const escapedCode = escapeHtml(block.data.code || 'Nothing to preview')
          finalHTML += `<div class="content-block code-block" data-blockid="${block.id}" data-code="${escapedCode}"></div>`
        } else if (block.type === BLOCK_TYPES.MEDIA) {
          if (block.data.isImage) {
            finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}"><img src="${block.data.url}" alt="Uploaded image" style="max-width:100%;height:auto;display:${block.data.align==='center'?'block':'inline'};margin:${block.data.align==='center'?'0 auto':''}" /></div>`
          } else if (block.data.isVideo) {
            finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}"><video controls style="max-width:100%;height:auto;display:${block.data.align==='center'?'block':'inline'};margin:${block.data.align==='center'?'0 auto':''}"><source src="${block.data.url}" type="${block.data.fileType}" /></video></div>`
          } else {
            finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}">Unsupported</div>`
          }
        }
      })
    return finalHTML
  }, [])

  const handleGenerateCodeBlock = useCallback(
    async (block) => {
      try {
        const prompt = block.data._tempAiPrompt || ''
        if (!prompt.trim()) {
          setFormErrorMessage('Prompt cannot be empty.')
          return
        }
        updateBlock({ ...block, data: { ...block.data, isBlockLoading: true } })
        setFormErrorMessage('')
        const response = await axios.post('/api/generate_content', {
          currentCode: block.data.code,
          parentCode: post ? post.content : null,
          request: prompt,
        })
        if (response.data && response.status === 201) {
          const { generatedContent } = response.data
          updateBlock({
            ...block,
            data: { ...block.data, code: generatedContent, isBlockLoading: false },
            isEditing: false,
          })
        } else {
          updateBlock({ ...block, data: { ...block.data, isBlockLoading: false } })
          setFormErrorMessage('Creation error.')
        }
      } catch {
        updateBlock({ ...block, data: { ...block.data, isBlockLoading: false } })
        setFormErrorMessage('Error creating content.')
      }
    },
    [isEdit, post, updateBlock]
  )

  const handleGenerateFullContent = useCallback(async () => {
    try {
      const prompt = globalAiPrompt.trim()
      if (!prompt) {
        setFormErrorMessage('Prompt cannot be empty.')
        return
      }
      setIsGlobalLoading(true)
      setFormErrorMessage('')
      const fullHTML = compileFinalHTML(blocks)
      const response = await axios.post('/api/generate_content', {
        currentCode: fullHTML,
        parentCode: post ? post.content : null,
        request: prompt,
      })
      if (response.data && response.status === 201) {
        const { generatedContent } = response.data
        setBlocks([
          {
            data: { code: generatedContent, isBlockLoading: false, showPrompt: true },
            id: uuidv4(),
            isEditing: false,
            type: BLOCK_TYPES.CODE,
          },
        ])
      } else {
        setFormErrorMessage('Creation error.')
      }
    } catch {
      setFormErrorMessage('Error creating content.')
    } finally {
      setIsGlobalLoading(false)
    }
  }, [blocks, compileFinalHTML, globalAiPrompt, isEdit, post])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (isContentEmpty(blocks)) {
        setFormErrorMessage('Post cannot be empty.')
        return
      }
      const finalHTML = compileFinalHTML(blocks)
      try {
        setFormErrorMessage('')
        const formData = new FormData()
        let postId
        if (!isEdit) {
          postId = uuidv4()
          formData.append('post_id', postId)
        } else {
          postId = post.post_id
        }
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
        setGlobalAiPrompt('')
        setShowForm(false)
        navigate(`/${urlPrefix}/${feed_name}/${channel_name}/${isReply ? post.post_id : postId}`)
      } catch {
        setFormErrorMessage('Error submitting the form.')
      }
    },
    [blocks, compileFinalHTML, isContentEmpty, isEdit, isReply, channel_name, feed_name, navigate, onSubmit, post, setShowForm, title, urlPrefix]
  )

  const toggleMediaAlignment = useCallback((block) => {
    const newAlign = block.data.align === 'left' ? 'center' : 'left'
    updateBlock({ ...block, data: { ...block.data, align: newAlign } })
  }, [updateBlock])

  return (
    <div className="create-post-container" style={{ paddingTop: isReply ? '0px' : '20px' }}>
      {isReply && <p className="text24">Reply</p>}
      {isReply && post && (
        <div className="post-reply-preview">
          <ContentWidget
            canRemove={false}
            feed={feed}
            isGroup={isGroup}
            onEditClick={() => {}}
            onPostRemoved={() => {}}
            onReplyClick={() => {}}
            post={post}
            readOnly
          />
        </div>
      )}
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
        <div
          className="action-buttons"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div className="left-buttons" style={{ display: 'flex', gap: '10px' }}>
            <button className="small-icon" onClick={() => setShowForm(false)} title="Close" type="button">
              <FaWindowClose />
            </button>
            <button className="small-icon" onClick={() => setEditMode(!editMode)} title={editMode ? 'Preview' : 'Edit'} type="button">
              {editMode ? <FaEye /> : <FaEdit />}
            </button>
            <button className="small-icon" type="submit" title={isEdit ? 'Save Edit' : isReply ? 'Reply' : 'Post'} >
              {isEdit ? <FaSave /> : isReply ? <FaReply /> : <FaArrowRight />}
            </button>
          </div>
          {editMode && (
            <div className="right-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button className="small-icon" onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)} title="Add text" type="button">
                <FaFont />
              </button>
              <label className="small-icon" htmlFor="media-input" title="Add media">
                <FaPhotoVideo />
              </label>
              <button className="small-icon" onClick={() => handleAddBlock(BLOCK_TYPES.CODE)} title="Add custom" type="button">
                <FaToolbox />
              </button>
            </div>
          )}
        </div>
        <div className="global-ai-prompt-container" style={{ marginTop: '10px' }}>
          <textarea
            className="ai-prompt"
            onChange={(e) => setGlobalAiPrompt(e.target.value)}
            placeholder="Describe changes for post..."
            value={globalAiPrompt}
          />
          <button
            className={isGlobalLoading || !globalAiPrompt.trim() ? 'large-icon disabled' : 'large-icon'}
            disabled={isGlobalLoading || !globalAiPrompt.trim()}
            onClick={handleGenerateFullContent}
            title={isGlobalLoading ? 'Creating...' : !globalAiPrompt.trim() ? 'Enter a prompt' : 'Create'}
            type="button"
          >
            {isGlobalLoading ? <FaCircleNotch /> : <FaPlus />}
          </button>
          <input accept="image/*,video/*" hidden id="media-input" multiple onChange={handleFilesChange} type="file" />
        </div>
        <p className="text16">{formErrorMessage}</p>
        {editMode && (<p className="text24" style={{ marginLeft: 0, marginTop: 0 }}>Editing</p>)}
        <div className={editMode ? "single-container edit" : "single-container"}>
          {editMode ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="blocks-droppable">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}>
                    {!blocks.length && <p className="text24">Add content using the buttons above</p>}
                    {blocks.map((block, index) => {
                      const { data, id, isEditing, type } = block
                      const toggleEdit = () => updateBlock({ ...block, isEditing: !isEditing })
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(provided2) => (
                            <div
                              className="block"
                              ref={provided2.innerRef}
                              style={{ marginBottom: '20px' }}
                              {...provided2.draggableProps}
                              {...provided2.dragHandleProps}
                            >
                              <div className="block-controls" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  {type === BLOCK_TYPES.CODE && isEditing && (
                                    <button
                                      className="small-icon"
                                      onClick={() => updateBlock({ ...block, data: { ...data, showPrompt: !data.showPrompt } })}
                                      title={data.showPrompt ? 'Direct input' : 'Prompt'}
                                      type="button"
                                    >
                                      {data.showPrompt ? <FaTerminal /> : <FaCommentAlt />}
                                    </button>
                                  )}
                                  <button className="small-icon" onClick={() => moveBlockUp(index)} title="Move up" type="button">
                                    <FaArrowUp />
                                  </button>
                                  <button className="small-icon" onClick={() => moveBlockDown(index)} title="Move down" type="button">
                                    <FaArrowDown />
                                  </button>
                                  <button className="small-icon" onClick={() => removeBlock(id)} title="Delete" type="button">
                                    <FaTimes />
                                  </button>
                                  {type !== BLOCK_TYPES.MEDIA && (
                                    <button className="small-icon" onClick={toggleEdit} title={isEditing ? 'Preview' : 'Edit'} type="button">
                                      {isEditing ? <FaEye /> : <FaEdit />}
                                    </button>
                                  )}
                                </div>
                                {type === BLOCK_TYPES.MEDIA && (
                                  <div>
                                    <button className="small-icon" onClick={() => toggleMediaAlignment(block)} title="Centre media" type="button">
                                      <FaAlignCenter />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {type === BLOCK_TYPES.TEXT && (
                                <div className="block-content">
                                  {isEditing ? (
                                    <ReactQuill
                                      className="text-editor"
                                      onChange={(val) => updateBlock({ ...block, data: { ...data, html: val } })}
                                      placeholder="Write your text..."
                                      theme="snow"
                                      value={data.html}
                                    />
                                  ) : (
                                    data.html.trim() ? <div className="text-preview" dangerouslySetInnerHTML={{ __html: data.html }} /> : <p>Nothing to preview</p>
                                  )}
                                </div>
                              )}
                              {type === BLOCK_TYPES.CODE && (
                                <div className="block-content">
                                  {isEditing && (
                                    <>
                                      {data.showPrompt ? (
                                        <div className="ai-generator">
                                          <textarea
                                            className="ai-prompt"
                                            onChange={(e) =>
                                              updateBlock({ ...block, data: { ...data, _tempAiPrompt: e.target.value } })
                                            }
                                            placeholder="Describe your content..."
                                          />
                                          <button
                                            className={data.isBlockLoading || !data._tempAiPrompt?.trim() ? 'small-icon disabled' : 'small-icon'}
                                            disabled={data.isBlockLoading || !data._tempAiPrompt?.trim()}
                                            onClick={() => handleGenerateCodeBlock(block)}
                                            title={data.isBlockLoading ? 'Creating...' : !data._tempAiPrompt?.trim() ? 'Enter a prompt' : 'Create'}
                                            type="button"
                                          >
                                            {data.isBlockLoading ? <FaCircleNotch /> : <FaPlus />}
                                          </button>
                                        </div>
                                      ) : (
                                        <textarea
                                          className="code-input"
                                          onChange={(e) =>
                                            updateBlock({ ...block, data: { ...data, code: e.target.value } })
                                          }
                                          placeholder="Enter code..."
                                          value={data.code}
                                        />
                                      )}
                                    </>
                                  )}
                                  {data.code.trim() ? (
                                    <div className="code-preview">
                                      <iframe
                                        ref={(el) => {
                                          iframeRefs.current[id] = el
                                        }}
                                        sandbox="allow-scripts allow-same-origin"
                                        srcDoc={getIframeSrcDoc(id, data.code)}
                                        style={{ border: 'none', width: '100%', height: '0px' }}
                                        title={`code-preview-${id}`}
                                      />
                                    </div>
                                  ) : (
                                    <p>Nothing to preview</p>
                                  )}
                                </div>
                              )}
                              {type === BLOCK_TYPES.MEDIA && (
                                <div className="media-preview">
                                  {data.isImage ? (
                                    <img alt="Uploaded Media" src={data.url} style={ data.align==='center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' } }/>
                                  ) : data.isVideo ? (
                                    <video controls src={data.url} style={ data.align==='center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' } }/>
                                  ) : (
                                    <p>Unsupported</p>
                                  )}
                                </div>
                              )}
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
          ) : (
            <>
              <p className="text24" style={{ marginLeft: 0, marginTop: 0 }}>
                Preview
              </p>
              <div className="live-preview-container">
                {blocks.map((block, i) => {
                  if (block.type === 'text') {
                    return block.data.html.trim() ? <div key={i} dangerouslySetInnerHTML={{ __html: block.data.html }} /> : null
                  }
                  if (block.type === 'code') {
                    return block.data.code.trim() ? (
                      <div key={i}>
                        <iframe
                          ref={(el) => {
                            iframeRefs.current[block.id] = el
                          }}
                          sandbox="allow-scripts allow-same-origin"
                          srcDoc={getIframeSrcDoc(block.id, block.data.code)}
                          style={{ border: 'none', width: '100%', height: '0px' }}
                          title={`live-preview-${i}`}
                        />
                      </div>
                    ) : null
                  }
                  if (block.type === 'media') {
                    if (block.data.isImage) {
                      return (
                        <div key={i}>
                          <img alt="Uploaded Media" src={block.data.url} style={ block.data.align==='center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' } }/>
                        </div>
                      )
                    } else if (block.data.isVideo) {
                      return (
                        <div key={i}>
                          <video controls style={ block.data.align==='center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' } }>
                            <source src={block.data.url} type={block.data.fileType} />
                          </video>
                        </div>
                      )
                    }
                    return <p key={i}>Unsupported</p>
                  }
                  return null
                })}
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  )
}

ContentForm.propTypes = {
  feed: PropTypes.object,
  isEdit: PropTypes.bool,
  isGroup: PropTypes.bool,
  isReply: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  post: PropTypes.object,
  setShowForm: PropTypes.func.isRequired,
}

export default ContentForm;