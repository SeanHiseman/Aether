import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { FaAlignCenter, FaArrowCircleUp, FaArrowDown, FaArrowRight, FaArrowUp, FaCircleNotch, FaCommentAlt, FaEdit, FaEye, FaFont, FaPhotoVideo, FaPlus, FaReply, FaSave, FaTerminal, FaTimes, FaToolbox, FaTrash, FaWindowClose } from 'react-icons/fa'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { v4 } from 'uuid'
import { AuthContext } from '../authContext'
import ContentWidget from './contentWidget'

const BLOCK_TYPES = { CODE: 'CODE', MEDIA: 'MEDIA', TEXT: 'TEXT' }

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
			result.push({ data: { code, isBlockLoading: false, showPrompt: true }, id: blockId, isEditing: false, type: BLOCK_TYPES.CODE })
		} else if (blockClass.includes('text-block')) {
			result.push({ data: { html: content }, id: blockId, isEditing: false, type: BLOCK_TYPES.TEXT })
		} else if (blockClass.includes('media-block')) {
			const img = div.querySelector('img')
			const video = div.querySelector('video')
			const align = div.getAttribute('data-align') || 'left'
			if (img) {
				result.push({ data: { file: null, fileType: 'image/*', isImage: true, isVideo: false, url: img.getAttribute('src'), align }, id: blockId, isEditing: false, type: BLOCK_TYPES.MEDIA })
			} else if (video) {
				const source = video.querySelector('source')
				result.push({ data: { file: null, fileType: source ? source.getAttribute('type') : '', isImage: false, isVideo: true, url: source ? source.getAttribute('src') : '', align }, id: blockId, isEditing: false, type: BLOCK_TYPES.MEDIA })
			} else {
				result.push({ data: { file: null, fileType: '', isImage: false, isVideo: false, url: '', align }, id: blockId, isEditing: false, type: BLOCK_TYPES.MEDIA })
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

//Post is either the post being edited or replied to
const ContentForm = ({ feed, isEdit = false, isGroup, isReply, onSubmit, post = null, setShowForm }) => {
	const [blocks, setBlocks] = useState([])
	const [editMode, setEditMode] = useState(true)
	const [formErrorMessage, setFormErrorMessage] = useState('')
	const [blockLimitError, setBlockLimitError] = useState('')
	const [globalAiPrompt, setGlobalAiPrompt] = useState('')
	const [isGlobalLoading, setIsGlobalLoading] = useState(false)
	const [title, setTitle] = useState('')
	const [showGlobalAiPrompt, setShowGlobalAiPrompt] = useState(false)
	const iframeRefs = useRef({})
	const { channel_name, feed_name } = useParams()
	const navigate = useNavigate()
	const urlPrefix = isGroup ? 'g' : 'u'
	const { user } = useContext(AuthContext)
	const hasMembership = user?.has_membership
	const BLOCK_LIMIT = hasMembership ? 10000 : 10
	const limitReached = user.usage_count >= usageLimit
	const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024
	const TEXT_CHAR_LIMIT = hasMembership ? 100000 : 1000
	const TITLE_CHAR_LIMIT = hasMembership ? 1000 : 100
	const usageLimit = user.has_membership ? 10000000 : 100000

	const isContentEmpty = useCallback(blocksArray => !blocksArray.some(block => {
		if (block.type === BLOCK_TYPES.TEXT) return block.data.html && block.data.html.trim() !== ''
		if (block.type === BLOCK_TYPES.CODE) return block.data.code && block.data.code.trim() !== ''
		if (block.type === BLOCK_TYPES.MEDIA) return block.data.url && block.data.url.trim() !== ''
		return false
	}), [])

	useEffect(() => {
		if (isEdit && post) {
			setTitle(post.title || '')
			const existingBlocks = parseContentBlocks(post.content || '')
			if (existingBlocks.length) setBlocks(existingBlocks)
			else setBlocks([{ data: { html: post.content }, id: v4(), isEditing: true, type: BLOCK_TYPES.TEXT }])
		}
	}, [isEdit, post])

	useEffect(() => {
		if (!isEdit) {
			setBlocks([{ data: { html: '' }, id: v4(), isEditing: true, type: BLOCK_TYPES.TEXT }])
		}
	}, [isEdit])

    const getIframeSrcDoc = useCallback((id, code) => {
		const trimmedCode = code.trim()
		const interactiveEditorScript = `
		<script>
		  // Interactive editing functionality
		  (function() {
			let selectedElement = null;
			let isResizing = false;
			let originalWidth, originalHeight, startX, startY;
			let editorActive = false;
			
			// Create editor controls
			function createEditorControls() {
			  const controls = document.createElement('div');
			  controls.id = 'editor-controls';
			  controls.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#333;padding:10px;border-radius:5px;z-index:9999;display:none;';
			  
			  // Color picker in controls
			  const colorLabel = document.createElement('span');
			  colorLabel.textContent = 'Color: ';
			  colorLabel.style.color = 'white';
			  
			  const colorPicker = document.createElement('input');
			  colorPicker.type = 'color';
			  colorPicker.id = 'color-picker';
			  colorPicker.onchange = function() {
				if (selectedElement) {
				  selectedElement.style.color = this.value;
				  sendHeight();
				}
			  };
			  
			  const closeBtn = document.createElement('button');
			  closeBtn.textContent = 'Close';
			  closeBtn.style.marginLeft = '10px';
			  closeBtn.onclick = () => { 
				controls.style.display = 'none'; 
				deselectElement(); 
			  };
			  
			  controls.appendChild(colorLabel);
			  controls.appendChild(colorPicker);
			  controls.appendChild(closeBtn);
			  document.body.appendChild(controls);
			  return controls;
			}
			
			// Create resize handles for the selected element
			function createResizeHandles(element) {
			  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
			  const container = document.createElement('div');
			  container.className = 'resize-container';
			  container.style.cssText = 'position:absolute;pointer-events:none;border:1px dashed blue;z-index:9998;';
			  
			  handles.forEach(pos => {
				const handle = document.createElement('div');
				handle.className = 'resize-handle ' + pos;
				handle.style.cssText = 'position:absolute;width:10px;height:10px;background:blue;border-radius:50%;z-index:10000;cursor:' + pos + '-resize;pointer-events:all;';
				
				// Position the handle
				if (pos.includes('n')) handle.style.top = '-5px';
				if (pos.includes('s')) handle.style.bottom = '-5px';
				if (pos.includes('e')) handle.style.right = '-5px';
				if (pos.includes('w')) handle.style.left = '-5px';
				if (pos === 'n' || pos === 's') handle.style.left = 'calc(50% - 5px)';
				if (pos === 'e' || pos === 'w') handle.style.top = 'calc(50% - 5px)';
				
				handle.addEventListener('mousedown', function(e) {
				  e.stopPropagation();
				  startResize(e, pos);
				});
				
				container.appendChild(handle);
			  });
			  
			  document.body.appendChild(container);
			  updateResizeContainer(element, container);
			  return container;
			}
			
			// Update resize container position and size to match selected element
			function updateResizeContainer(element, container) {
			  const rect = element.getBoundingClientRect();
			  container.style.top = rect.top + 'px';
			  container.style.left = rect.left + 'px';
			  container.style.width = rect.width + 'px';
			  container.style.height = rect.height + 'px';
			}
			
			// Make element editable
			function makeEditable(element) {
			  if (!element) return;
			  
			  // Skip if it's already editable or is a form element
			  if (element.isContentEditable || 
				  element.tagName === 'INPUT' || 
				  element.tagName === 'TEXTAREA' ||
				  element.tagName === 'SELECT') {
				return;
			  }
			  
			  element.contentEditable = true;
			  
			  // Focus and highlight content
			  element.focus();
			  
			  // Update color picker to match current color
			  const colorPicker = document.getElementById('color-picker');
			  if (colorPicker) {
				const computedStyle = window.getComputedStyle(element);
				colorPicker.value = rgbToHex(computedStyle.color);
			  }
			  
			  // Listen for blur to apply changes
			  element.addEventListener('blur', function onBlur() {
				element.contentEditable = false;
				element.removeEventListener('blur', onBlur);
				sendHeight();
			  }, { once: true });
			}
			
			// Select element when clicked
			function selectElement(e) {
			  if (!editorActive) return;
			  if (e.target.id === 'editor-controls' || e.target.closest('#editor-controls')) return;
			  if (e.target.className.includes('resize-handle')) return;
			  if (e.target.id === 'toggle-editor') return;
			  
			  // Deselect previous element
			  deselectElement();
			  
			  selectedElement = e.target;
			  
			  // Don't select body or html
			  if (selectedElement === document.body || selectedElement === document.documentElement) {
				selectedElement = null;
				return;
			  }
			  
			  // Show element is selected
			  selectedElement.dataset.originalOutline = selectedElement.style.outline;
			  selectedElement.style.outline = '2px solid blue';
			  
			  // Show controls
			  const controls = document.getElementById('editor-controls') || createEditorControls();
			  controls.style.display = 'block';
			  
			  // Update color picker
			  const colorPicker = document.getElementById('color-picker');
			  if (colorPicker) {
				const computedStyle = window.getComputedStyle(selectedElement);
				colorPicker.value = rgbToHex(computedStyle.color);
			  }
			  
			  // Create resize handles
			  createResizeHandles(selectedElement);
			  
			  // Make text editable with double click
			  selectedElement.addEventListener('dblclick', function onDblClick(evt) {
				evt.stopPropagation();
				makeEditable(selectedElement);
			  }, { once: true });
			  
			  e.stopPropagation();
			}
			
			// Deselect the current element
			function deselectElement() {
			  if (!selectedElement) return;
			  
			  // Remove outline
			  selectedElement.style.outline = selectedElement.dataset.originalOutline || '';
			  delete selectedElement.dataset.originalOutline;
			  
			  // Remove contentEditable
			  selectedElement.contentEditable = false;
			  
			  // Remove resize handles
			  const container = document.querySelector('.resize-container');
			  if (container) container.remove();
			  
			  selectedElement = null;
			}
			
			// Convert RGB to Hex
			function rgbToHex(rgb) {
			  if (!rgb) return '#000000';
			  if (rgb.startsWith('#')) return rgb;
			  
			  // Handle rgba format
			  if (rgb.startsWith('rgba')) {
				const parts = rgb.match(/^rgba\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)$/);
				if (!parts) return '#000000';
				
				const r = parseInt(parts[1]).toString(16).padStart(2, '0');
				const g = parseInt(parts[2]).toString(16).padStart(2, '0');
				const b = parseInt(parts[3]).toString(16).padStart(2, '0');
				return '#' + r + g + b;
			  }
			  
			  // Handle rgb format
			  const parts = rgb.match(/^rgb\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)$/);
			  if (!parts) return '#000000';
			  
			  const r = parseInt(parts[1]).toString(16).padStart(2, '0');
			  const g = parseInt(parts[2]).toString(16).padStart(2, '0');
			  const b = parseInt(parts[3]).toString(16).padStart(2, '0');
			  return '#' + r + g + b;
			}
			
			// Start resizing the element
			function startResize(e, position) {
			  if (!selectedElement) return;
			  
			  isResizing = true;
			  startX = e.clientX;
			  startY = e.clientY;
			  originalWidth = selectedElement.offsetWidth;
			  originalHeight = selectedElement.offsetHeight;
			  
			  const resizePos = position;
			  
			  function doResize(e) {
				if (!isResizing) return;
				
				e.preventDefault();
				
				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;
				
				let newWidth = originalWidth;
				let newHeight = originalHeight;
				
				// Update dimensions based on drag position
				if (resizePos.includes('e')) newWidth = originalWidth + deltaX;
				if (resizePos.includes('w')) newWidth = originalWidth - deltaX;
				if (resizePos.includes('s')) newHeight = originalHeight + deltaY;
				if (resizePos.includes('n')) newHeight = originalHeight - deltaY;
				
				// Apply new dimensions
				if (newWidth > 10) selectedElement.style.width = newWidth + 'px';
				if (newHeight > 10) selectedElement.style.height = newHeight + 'px';
				
				// Update resize handles
				const container = document.querySelector('.resize-container');
				updateResizeContainer(selectedElement, container);
				
				sendHeight();
			  }
			  
			  function stopResize() {
				isResizing = false;
				document.removeEventListener('mousemove', doResize);
				document.removeEventListener('mouseup', stopResize);
			  }
			  
			  document.addEventListener('mousemove', doResize);
			  document.addEventListener('mouseup', stopResize);
			  
			  e.preventDefault();
			}
			
			// Get the current edited HTML
			function getEditedHTML() {
			  return document.documentElement.outerHTML;
			}
			
			// Listen for messages from the parent frame
			window.addEventListener('message', function(event) {
			  if (event.data.action === 'getEditedContent') {
				// Send back the current HTML
				parent.postMessage({
				  action: 'editedContentReady',
				  blockId: '${id}',
				  editedContent: getEditedHTML()
				}, '*');
			  }
			});
			
			// Initialize the editor
			function initEditor() {
			  // Add editor toggle button
			  const toggleBtn = document.createElement('button');
			  toggleBtn.id = 'toggle-editor';
			  toggleBtn.textContent = 'Edit Mode: OFF';
			  toggleBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10001;background:#4a90e2;color:white;border:none;padding:8px 12px;border-radius:4px;';
			  
			  toggleBtn.onclick = function() {
				editorActive = !editorActive;
				
				if (editorActive) {
				  document.addEventListener('click', selectElement);
				  toggleBtn.textContent = 'Edit Mode: ON';
				  toggleBtn.style.background = '#e74c3c';
				  
				  // Show instructions
				  const instructions = document.createElement('div');
				  instructions.id = 'editor-instructions';
				  instructions.style.cssText = 'position:fixed;top:50px;right:10px;background:rgba(0,0,0,0.7);color:white;padding:10px;border-radius:4px;z-index:10001;font-size:12px;max-width:250px;';
				  instructions.innerHTML = '<p><b>Editor Instructions:</b></p>' +
										   '<p>- Click any element to select it</p>' +
										   '<p>- Double-click text to edit it</p>' +
										   '<p>- Use color picker to change text color</p>' +
										   '<p>- Drag blue handles to resize</p>' +
										   '<p>- Press ESC to deselect</p>';
				  document.body.appendChild(instructions);
				  
				  setTimeout(() => {
					const inst = document.getElementById('editor-instructions');
					if (inst) inst.style.opacity = '0';
					setTimeout(() => {
					  if (inst) inst.remove();
					}, 1000);
				  }, 5000);
				  
				} else {
				  document.removeEventListener('click', selectElement);
				  deselectElement();
				  const controls = document.getElementById('editor-controls');
				  if (controls) controls.style.display = 'none';
				  toggleBtn.textContent = 'Edit Mode: OFF';
				  toggleBtn.style.background = '#4a90e2';
				  
				  const instructions = document.getElementById('editor-instructions');
				  if (instructions) instructions.remove();
				}
			  };
			  
			  document.body.appendChild(toggleBtn);
			  
			  // Handle escape key
			  document.addEventListener('keydown', function(e) {
				if (e.key === 'Escape') {
				  deselectElement();
				  const controls = document.getElementById('editor-controls');
				  if (controls) controls.style.display = 'none';
				}
			  });
			}
			
			// Wait for DOM to be ready
			if (document.readyState === 'loading') {
			  document.addEventListener('DOMContentLoaded', initEditor);
			} else {
			  initEditor();
			}
		  })();
		</script>`;
		
		const scriptToInject = `<script>
		  function sendHeight() {
			var newHeight = document.documentElement.scrollHeight;
			parent.postMessage({ blockId: '${id}', height: newHeight }, '*');
		  }
		  window.addEventListener('load', sendHeight);
		  var observer = new MutationObserver(sendHeight);
		  observer.observe(document.body, {childList:true, subtree:true, characterData:true});
		  sendHeight();
		</script>`;
		
		let srcDoc = '';
		if (/<html[\s>]/i.test(trimmedCode)) {
		  if (/<\/body>/i.test(trimmedCode)) {
			srcDoc = trimmedCode.replace(/<\/body>/i, interactiveEditorScript + scriptToInject + '</body>');
		  } else {
			srcDoc = trimmedCode + interactiveEditorScript + scriptToInject;
		  }
		} else {
		  srcDoc = `<!DOCTYPE html><html><head><style>html,body { margin:0; padding:0; }</style></head><body><div id="content">${code}</div>${interactiveEditorScript}${scriptToInject}</body></html>`;
		}
		return srcDoc;
	  }, []);

	  useEffect(() => {
		function handleIframeMessage(event) {
		  const { blockId, height, action, editedContent } = event.data;
		  
		  // Handle height updates
		  if (blockId && height) {
			const iframe = iframeRefs.current[blockId];
			if (iframe) iframe.style.height = `${height}px`;
		  }
		  
		  // Handle receiving edited content
		  if (action === 'editedContentReady' && blockId && editedContent) {
			setBlocks(prev => 
			  prev.map(block => 
				block.id === blockId
				  ? { ...block, data: { ...block.data, code: editedContent } }
				  : block
			  )
			);
			
			// Show a confirmation message
			setFormErrorMessage('Changes saved successfully!');
			setTimeout(() => setFormErrorMessage(''), 2000);
		  }
		}
	  
		window.addEventListener('message', handleIframeMessage);
		return () => window.removeEventListener('message', handleIframeMessage);
	  }, [iframeRefs]);

	const handleAddBlock = useCallback(type => {
		setBlockLimitError('')
		if (blocks.length >= BLOCK_LIMIT) {
			setBlockLimitError(hasMembership ? `Block limit (${BLOCK_LIMIT}) reached.` : `Free block limit (${BLOCK_LIMIT}) reached. Get membership to add more:`)
			return
		}
		const newBlock = {
			data: type === BLOCK_TYPES.TEXT ? { html: '' } : type === BLOCK_TYPES.CODE ? { code: '', isBlockLoading: false, showPrompt: true } : { file: null, fileType: '', isImage: false, isVideo: false, url: '', align: 'left' },
			id: v4(),
			isEditing: type !== BLOCK_TYPES.MEDIA,
			type
		}
		setBlocks(prev => [newBlock, ...prev])
	}, [blocks.length, BLOCK_LIMIT, hasMembership])

	const handleFilesChange = useCallback(event => {
		setBlockLimitError('')
		if (blocks.length >= BLOCK_LIMIT) {
			setBlockLimitError(hasMembership ? `Block limit (${BLOCK_LIMIT}) reached.` : `Free block limit (${BLOCK_LIMIT}) reached. Get membership to add more:`)
			return
		}
		const files = Array.from(event.target.files)
		const oversized = files.filter(f => f.size > MAX_FILE_SIZE)
		if (oversized.length) {
			const names = oversized.map(f => f.name).join(', ')
			setFormErrorMessage(hasMembership ? `These files exceed your max size limit: ${names}.` : `These files exceed your max size limit: ${names}. Get membership for more.`);
			return
		}
		setFormErrorMessage('')
		const canFitCount = Math.max(0, BLOCK_LIMIT - blocks.length)
		const fittingFiles = hasMembership ? files : files.slice(0, canFitCount)
		const uniqueFiles = fittingFiles.map(file => {
			const ext = file.name.substring(file.name.lastIndexOf('.'))
			const uniqueName = `${Date.now()}-${v4()}${ext}`
			return new File([file], uniqueName, { type: file.type })
		})
		const mediaBlocks = uniqueFiles.map(file => ({
			data: { file, fileType: file.type, isImage: file.type.startsWith('image/'), isVideo: file.type.startsWith('video/'), url: URL.createObjectURL(file), align: 'left' },
			id: v4(),
			isEditing: false,
			type: BLOCK_TYPES.MEDIA
		}))
		setBlocks(prev => [...prev, ...mediaBlocks])
	}, [MAX_FILE_SIZE, BLOCK_LIMIT, blocks.length, hasMembership])

	const moveBlockDown = useCallback(index => {
		if (index === blocks.length - 1) return
		setBlocks(prev => {
			const updated = [...prev]
			;[updated[index + 1], updated[index]] = [updated[index], updated[index + 1]]
			return updated
		})
	}, [blocks.length])

	const moveBlockUp = useCallback(index => {
		if (index === 0) return
		setBlocks(prev => {
			const updated = [...prev]
			;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
			return updated
		})
	}, [])

	const removeBlock = useCallback(blockId => {
		setBlocks(prev => prev.filter(block => block.id !== blockId))
		if (iframeRefs.current[blockId]) delete iframeRefs.current[blockId]
	}, [])

	const updateBlock = useCallback(updatedBlock => {
		setBlocks(prev => prev.map(b => (b.id === updatedBlock.id ? updatedBlock : b)))
	}, [])

	const onDragEnd = useCallback(result => {
		const { destination, source } = result
		if (!destination) return
		if (destination.index === source.index) return
		setBlocks(prev => reorder(prev, source.index, destination.index))
	}, [])

	const compileFinalHTML = useCallback(allBlocks => {
		let finalHTML = ''
		allBlocks.filter(block => {
			if (block.type === BLOCK_TYPES.TEXT) return block.data.html && block.data.html.trim() !== ''
			if (block.type === BLOCK_TYPES.CODE) return block.data.code && block.data.code.trim() !== ''
			if (block.type === BLOCK_TYPES.MEDIA) return block.data.url && block.data.url.trim() !== ''
			return false
		}).forEach(block => {
			if (block.type === BLOCK_TYPES.TEXT) {
				finalHTML += `<div class="content-block text-block" data-blockid="${block.id}">${block.data.html || 'Nothing to preview'}</div>`
			} else if (block.type === BLOCK_TYPES.CODE) {
				const escapedCode = escapeHtml(block.data.code || 'Nothing to preview')
				finalHTML += `<div class="content-block code-block" data-blockid="${block.id}" data-code="${escapedCode}"></div>`
			} else if (block.type === BLOCK_TYPES.MEDIA) {
				if (block.data.isImage) {
					finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}"><img src="${block.data.url}" alt="Uploaded image" style="max-width:100%;height:auto;display:${block.data.align === 'center' ? 'block' : 'inline'};margin:${block.data.align === 'center' ? '0 auto' : ''}" /></div>`
				} else if (block.data.isVideo) {
					finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}"><video controls style="max-width:100%;height:auto;display:${block.data.align === 'center' ? 'block' : 'inline'};margin:${block.data.align === 'center' ? '0 auto' : ''}"><source src="${block.data.url}" type="${block.data.fileType}" /></video></div>`
				} else {
					finalHTML += `<div class="content-block media-block" data-blockid="${block.id}" data-align="${block.data.align}">Unsupported</div>`
				}
			}
		})
		return finalHTML
	}, [])

	const handleGenerateCodeBlock = useCallback(async block => {
		if (limitReached) {
		  setFormErrorMessage(hasMembership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
		  return;
		}
		try {
		  const prompt = block.data._tempAiPrompt || '';
		  if (!prompt.trim()) {
			setFormErrorMessage('Prompt cannot be empty.');
			return;
		  }
		  updateBlock({ ...block, data: { ...block.data, isBlockLoading: true, _tempAiPrompt: '' } });
		  setFormErrorMessage('');
		  const response = await axios.post('/api/generate_content', { 
			currentCode: block.data.code, 
			parentCode: isReply ? post.content : null, 
			request: prompt, 
			senderId: user.user_id,
			enableInteractiveEditing: true // Add this flag to let the backend know
		  });
		  if (response.data && response.status === 201) {
			const { generatedContent } = response.data;
			updateBlock({ 
			  ...block, 
			  data: { 
				...block.data, 
				code: generatedContent, 
				isBlockLoading: false, 
				_tempAiPrompt: '', 
				isInteractiveEditable: true // Add this flag to track interactive editing capability
			  }, 
			  isEditing: false 
			});
		  } else {
			updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
			setFormErrorMessage('Error creating content.');
		  }
		} catch {
		  updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
		  setFormErrorMessage('Error creating content.');
		}
	}, [hasMembership, post, updateBlock]);

	const handleGenerateFullContent = useCallback(async () => {
		if (limitReached) {
			setFormErrorMessage(hasMembership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
			return;
		}
		try {
			const prompt = globalAiPrompt.trim()
			if (!prompt) {
				setFormErrorMessage('Prompt cannot be empty.')
				return
			}
			setIsGlobalLoading(true)
			setFormErrorMessage('')
			const fullHTML = compileFinalHTML(blocks)
			const response = await axios.post('/api/generate_content', { currentCode: fullHTML, parentCode: isReply ? post.content : null, request: prompt, senderId: user.user_id })
			if (response.data && response.status === 201) {
				const { generatedContent } = response.data
				setBlocks([{ data: { code: generatedContent, isBlockLoading: false, showPrompt: true }, id: v4(), isEditing: false, type: BLOCK_TYPES.CODE }])
			} else setFormErrorMessage('Creation error.')
		} catch {
			setFormErrorMessage('Error creating content.')
		} finally {
			setIsGlobalLoading(false)
		}
	}, [blocks, compileFinalHTML, globalAiPrompt, hasMembership, post])

	const handleSubmit = useCallback(async e => {
		e.preventDefault()
		if (isContentEmpty(blocks)) {
			setFormErrorMessage(isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.')
			return
		}
		const finalHTML = compileFinalHTML(blocks)
		try {
			setFormErrorMessage('')
			const formData = new FormData()
			let postId
			if (!isEdit) {
				postId = v4()
				formData.append('post_id', postId)
			} else postId = post.post_id
			formData.append('content', finalHTML)
			if (isReply && post) formData.append('parent_id', post.post_id)
			if (!isReply) formData.append('title', title)
			blocks.filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.file).forEach(mediaBlock => formData.append('files', mediaBlock.data.file))
			await onSubmit(formData)
			setTitle('')
			setBlocks([])
			setGlobalAiPrompt('')
			setShowForm(false)
			navigate(`/${urlPrefix}/${feed_name}/${channel_name}/${isReply ? post.post_id : postId}`)
		} catch (error){
			setFormErrorMessage('Error submitting the form.')
		}
	}, [blocks, compileFinalHTML, isContentEmpty, isEdit, isReply, channel_name, feed_name, navigate, onSubmit, post, setShowForm, title, urlPrefix])

	useEffect(() => {
		function handleIframeMessage(event) {
		  const { blockId, height, action, editedContent } = event.data;
		  
		  if (blockId && height) {
			const iframe = iframeRefs.current[blockId];
			if (iframe) iframe.style.height = `${height}px`;
		  }
		  
		  // Handle edited content from the iframe
		  if (action === 'editedContentReady' && blockId && editedContent) {
			setBlocks(prev => 
			  prev.map(block => 
				block.id === blockId
				? { ...block, data: { ...block.data, code: editedContent } }
				: block
			  )
			);
		  }
		}
		
		window.addEventListener('message', handleIframeMessage);
		return () => window.removeEventListener('message', handleIframeMessage);
	  }, []);

	const toggleMediaAlignment = useCallback(block => {
		const newAlign = block.data.align === 'left' ? 'center' : 'left'
		updateBlock({ ...block, data: { ...block.data, align: newAlign } })
	}, [updateBlock])

	return (
		<div className="create-post-container" style={{ paddingTop: isReply ? '0px' : '20px' }}>
			{isReply && <p className="text24">Reply</p>}
			{isReply && post && (
				<div className="post-reply-preview">
					<ContentWidget canRemove={false} feed={feed} isGroup={isGroup} onEditClick={() => {}} onPostRemoved={() => {}} onReplyClick={() => {}} post={post} readOnly />
				</div>
			)}
			<form className="post-form" id="post-form" onSubmit={handleSubmit}>
				<div className="action-buttons-sticky" style={{ width: '100%' }}>
					<div className="action-buttons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<div className="left-buttons" style={{ display: 'flex', gap: '10px' }}>
							<button className="small-icon" onClick={() => setShowForm(false)} title="Close" type="button"><FaWindowClose /></button>
							<button className="small-icon" onClick={() => setEditMode(!editMode)} title={editMode ? 'Preview' : 'Edit'} type="button">
								{editMode ? <FaEye /> : <FaEdit />}
							</button>
							{!showGlobalAiPrompt ? (
								<button className="small-icon" onClick={() => setShowGlobalAiPrompt(true)} title="Assistance" type="button"><FaPlus /></button>
							) : (
								<button className="small-icon" onClick={() => setShowGlobalAiPrompt(false)} title="Hide assistance" type="button"><FaTimes /></button>
							)}
							<button className="small-icon" type="submit" title={isEdit ? 'Save Edit' : isReply ? 'Reply' : 'Post'} form="post-form">
								{isEdit ? <FaSave /> : isReply ? <FaReply /> : <FaArrowRight />}
							</button>
						</div>
						{editMode && (
							<div className="right-buttons" style={{ display: 'flex', gap: '10px' }}>
								<button className="small-icon" onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)} title="Add text" type="button"><FaFont /></button>
								<label className="small-icon" htmlFor="media-input" title="Add media"><FaPhotoVideo /></label>
								<button className="small-icon" onClick={() => handleAddBlock(BLOCK_TYPES.CODE)} title="Add custom" type="button"><FaToolbox /></button>
							</div>
						)}
					</div>
        		</div>
				{(blockLimitError || formErrorMessage) && (
					<p className="text16" style={{ display: 'flex', alignItems: 'center', margin: '0' }}>
						{blockLimitError || formErrorMessage}
						{blockLimitError && (
							<button className="small-icon" onClick={() => navigate('/membership')} type="button" style={{ marginLeft: '5px' }} title="Get Membership">
								<FaArrowCircleUp />
							</button>
						)}
					</p>
				)}
				{!isReply && (
					<input 
						className="title-input" 
						id="title-entry" 
						onChange={(e) => {
							const input = e.target.value;
							if (input.length <= TITLE_CHAR_LIMIT) {
								setTitle(input);
								setFormErrorMessage('');
							} else {
								setFormErrorMessage('Title exceeds character limit.', !user.has_membership && 'Get membership for more.');
							}
						}}
						placeholder="Add title (optional)..." 
						type="text" 
						value={title} />
				)}
				{showGlobalAiPrompt && (
					<div className="global-ai-prompt-container">
						<textarea className="ai-prompt" 
							disabled={limitReached} 
							onChange={(e) => {
								const input = e.target.value;
								if (input.length <= TEXT_CHAR_LIMIT) {
									setGlobalAiPrompt(input);
									setFormErrorMessage('');
								} else {
									setFormErrorMessage('Prompt exceeds character limit.', !user.has_membership && 'Get membership for more.');
								}
							}}
							placeholder={limitReached ? user.has_membership ? "Usage limit reached" : "Usage limit reached. Get membership for more." : "Describe changes for post..."} 
							value={globalAiPrompt}/>
						<button className={isGlobalLoading || !globalAiPrompt.trim() || limitReached ? 'large-icon disabled' : 'large-icon'} 
							disabled={isGlobalLoading || !globalAiPrompt.trim() || limitReached} 
							onClick={handleGenerateFullContent} 
							title={limitReached ? "Usage limit reached" : isGlobalLoading ? 'Creating...' : !globalAiPrompt.trim() ? 'Enter a prompt' : 'Create'} 
							type="button">
							{isGlobalLoading ? <FaCircleNotch /> : <FaArrowCircleUp />}
						</button>
					</div>
				)}
				<input accept="image/*,video/*" hidden id="media-input" multiple onChange={handleFilesChange} type="file" />
				{editMode && <p className="text24" style={{ marginLeft: 0, marginTop: 0 }}>Editing</p>}
				<div className={editMode ? 'single-container edit' : 'single-container'}>
					{editMode ? (
						<DragDropContext onDragEnd={onDragEnd}>
							<Droppable droppableId="blocks-droppable">
								{provided => (
									<div ref={provided.innerRef} {...provided.droppableProps}>
										{!blocks.length && <p className="text24 dark-text">Add content using the buttons above</p>}
										{blocks.map((block, index) => {
											const { data, id, isEditing, type } = block
											const toggleEdit = () => updateBlock({ ...block, isEditing: !isEditing })
											return (
												<Draggable key={id} draggableId={id} index={index}>
													{provided2 => (
														<div className="block" ref={provided2.innerRef} style={{ marginBottom: '20px' }} {...provided2.draggableProps} {...provided2.dragHandleProps}>
															<div className="block-controls" style={{ display: 'flex', justifyContent: 'space-between' }}>
																<div style={{ display: 'flex', gap: '10px' }}>
																	{type === BLOCK_TYPES.CODE && isEditing && (
																		<button className="small-icon" onClick={() => updateBlock({ ...block, data: { ...data, showPrompt: !data.showPrompt } })} title={data.showPrompt ? 'Direct input' : 'Prompt'} type="button">
																			{data.showPrompt ? <FaTerminal /> : <FaCommentAlt />}
																		</button>
																	)}
																	<button className="small-icon" onClick={() => moveBlockUp(index)} title="Move up" type="button"><FaArrowUp /></button>
																	<button className="small-icon" onClick={() => moveBlockDown(index)} title="Move down" type="button"><FaArrowDown /></button>
																	<button className="small-icon" onClick={() => removeBlock(id)} title="Delete" type="button"><FaTrash /></button>
																	{type !== BLOCK_TYPES.MEDIA && (
																		<button className="small-icon" onClick={toggleEdit} title={isEditing ? 'Preview' : 'Edit'} type="button">{isEditing ? <FaEye /> : <FaEdit />}</button>
																	)}
																</div>
																{type === BLOCK_TYPES.MEDIA && (
																	<div>
																		<button className="small-icon" onClick={() => toggleMediaAlignment(block)} title="Centre media" type="button"><FaAlignCenter /></button>
																	</div>
																)}
															</div>
															{type === BLOCK_TYPES.TEXT && (
																<div className="block-content">
																	{data.textError && (
																		<div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '5px' }}>
																			{data.textError}
																			<button className="small-icon" onClick={() => navigate('/membership')} type="button" style={{ marginLeft: '5px' }}><FaArrowCircleUp /></button>
																		</div>
																	)}
																	{isEditing ? (
																		<ReactQuill
																			className="text-editor"
																			onChange={val => {
																				const plainText = val.replace(/<[^>]*>/g, '')
																				if (plainText.length < TEXT_CHAR_LIMIT) {
																					updateBlock({ ...block, data: { ...data, html: val, textError: '' } })
																				} else {
																					updateBlock({ ...block, data: { ...data, textError: `Exceeded ${TEXT_CHAR_LIMIT} character limit. ${!user.has_membership && 'Get membership for more.'}` } })
																				}
																			}}
																			placeholder="Begin writing..."
																			theme="snow"
																			value={data.html}
																		/>
																	) : data.html.trim() ? (
																		<div className="text-preview" dangerouslySetInnerHTML={{ __html: data.html }} />
																	) : (
																		<p>Nothing to preview</p>
																	)}
																</div>
															)}
															{type === BLOCK_TYPES.CODE && (
																<div className="block-content">
																	{!data.showPrompt && <p className="text16" style={{color: '#7b7b7b', marginLeft: '0px'}}>For now, only one HTML file with inline JavaScript and CSS can be created.</p>}
																	{isEditing && (
																		<>
																			{data.showPrompt ? (
																				<div className="ai-generator">
																					<textarea className="ai-prompt" 
																						disabled={limitReached} 
																						onChange={(e) => {
																							const input = e.target.value;
																							if (input.length <= TEXT_CHAR_LIMIT) {
																								updateBlock({ ...block, data: { ...data, _tempAiPrompt: input } });
																								setFormErrorMessage('');
																							} else {
																								updateBlock({ ...block, data: { ...data, _tempAiPrompt: input } });
																								setFormErrorMessage('Prompt exceeds character limit.', !user.has_membership && 'Get membership for more.');
																							}
																						}}
																						placeholder={limitReached ? (user.has_membership ? "Usage limit reached" 
																							: "Usage limit reached. Get membership for more.") 
																							: data.isBlockLoading ? "Creating..." 
																							: user.has_membership ? "Describe your content..."
																							: "Describe your content... (Get membership for the best responses)"
																						}
																						value={data._tempAiPrompt || ''}/>
																					<button className={data.isBlockLoading || !data._tempAiPrompt?.trim() || limitReached ? 'small-icon disabled' : 'small-icon'} 
																						disabled={data.isBlockLoading || !data._tempAiPrompt?.trim() || limitReached} 
																						onClick={() => handleGenerateCodeBlock(block)} 
																						title={limitReached ? (user.has_membership ? "Usage limit reached" 
																							: "Usage limit reached. Get membership for more.") 
																							: data.isBlockLoading ? 'Creating...' 
																							: !data._tempAiPrompt?.trim() ? 'Enter a prompt' 
																							: 'Create'
																						}
																						type="button">
																						{data.isBlockLoading ? <FaCircleNotch className="spinner" /> : <FaArrowCircleUp />}
																					</button>
																				</div>
																			) : (
																				<textarea className="code-input" onChange={e => updateBlock({ ...block, data: { ...data, code: e.target.value } })} placeholder="Enter code..." value={data.code} />
																			)}
																		</>
																	)}
																	{data.code.trim() ? (
																		<div className="code-preview">
																			<iframe ref={el => { iframeRefs.current[id] = el }} sandbox="allow-scripts allow-same-origin" srcDoc={getIframeSrcDoc(id, data.code)} style={{ border: 'none', width: '100%', height: '0px' }} title={`code-preview-${id}`} />
																		</div>
																	) : (
																		<p>Nothing to preview</p>
																	)}
																</div>
															)}
															{type === BLOCK_TYPES.MEDIA && (
																<div className="media-preview">
																	{data.isImage ? (
																		<img alt="Uploaded Media" src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
																	) : data.isVideo ? (
																		<video controls src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
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
							<p className="text24" style={{ marginLeft: 0, marginTop: 0 }}>Preview</p>
							<div className="live-preview-container">
								{blocks.map((block, i) => {
									const { data, type } = block
									if (type === BLOCK_TYPES.TEXT) {
										return data.html.trim() ? <div key={i} dangerouslySetInnerHTML={{ __html: data.html }} /> : null
									}
									if (type === BLOCK_TYPES.CODE) {
										return data.code.trim() ? (
											<div key={i}>
												<iframe ref={el => { iframeRefs.current[block.id] = el }} sandbox="allow-scripts allow-same-origin" srcDoc={getIframeSrcDoc(block.id, data.code)} style={{ border: 'none', width: '100%', height: '0px' }} title={`live-preview-${i}`} />
											</div>
										) : null
									}
									if (type === BLOCK_TYPES.MEDIA) {
										if (data.isImage) {
											return (
												<div key={i}>
													<img alt="Uploaded Media" src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
												</div>
											)
										} else if (data.isVideo) {
											return (
												<div key={i}>
													<video controls style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }}>
														<source src={data.url} type={data.fileType} />
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