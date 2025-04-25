import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { FaAlignCenter, FaArrowCircleUp, FaArrowRight, FaCircleNotch, FaCommentAlt, FaEdit, FaEllipsisV, FaEye, FaFont, FaLink, FaPhotoVideo, FaPlus, FaReply, FaSave, FaShareAlt, FaTerminal, FaTimes, FaToolbox, FaTrash, FaWindowClose } from 'react-icons/fa'
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
	const [codeBlockDropdown, setCodeBlockDropdown] = useState(false)
	const [editMode, setEditMode] = useState(true)
	const [formErrorMessage, setFormErrorMessage] = useState('')
	const [blockLimitError, setBlockLimitError] = useState('')
	const [globalAiPrompt, setGlobalAiPrompt] = useState('')
	const [isGlobalLoading, setIsGlobalLoading] = useState(false)
	const [showGlobalAiPrompt, setShowGlobalAiPrompt] = useState(false)
	const [title, setTitle] = useState('')
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

	const addIframe = (blockId) => {
		const url = prompt('Enter the website URL:');
		if (url) {
			try {
				const parsedUrl = new URL(url);	//Validate URL format
				if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
					alert('Please enter a valid http or https URL');
					return;
				}
				const updatedBlocks = blocks.map(block => {
					if (block.id === blockId && block.type === BLOCK_TYPES.CODE) {
						const iframeCode = `<div style="width:100%; height:400px;">
							<iframe src="${parsedUrl.href}" style="width:100%; height:100%; border:none;" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>
							</div>`;
						return { 
							...block, 
							data: { 
							...block.data, 
							code: block.data.code ? block.data.code + '\n\n' + iframeCode : iframeCode 
							} 
						};
					}
					return block;
				});
				setBlocks(updatedBlocks);
			} catch (error) {
				alert('Please enter a valid URL (e.g., https://example.com)');
			}
		}
	}
		
	const addSocialMedia = (blockId) => {
		const url = prompt('Enter the social media embed code or URL:');
		if (url) {
			const updatedBlocks = blocks.map(block => {
				if (block.id === blockId && block.type === BLOCK_TYPES.CODE) {
					let embedCode = url;
					if (url.trim().startsWith('http') && !url.includes('<')) { 	//If it looks like just a URL, validate and wrap it
						try {
							const parsedUrl = new URL(url); //Validate URL format
							if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
								alert('Please enter a valid http or https URL');
								return block;
							}
							embedCode = `<div class="social-media-embed" style="width:100%; overflow:hidden;">
								<!-- Social media embed for ${parsedUrl.href} -->
								<a href="${parsedUrl.href}" target="_blank" rel="noopener noreferrer">${parsedUrl.href}</a>
								<!-- Replace this comment with proper embed code if available -->
								</div>`;
						} catch (error) {
							alert('Please enter a valid URL or embed code');
							return block;
						}
					}
					return { 
						...block, 
						data: { 
							...block.data, 
							code: block.data.code ? block.data.code + '\n\n' + embedCode : embedCode 
						} 
					};
				}
				return block;
			});
			setBlocks(updatedBlocks);
		}
	}

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

	//This section is AI generated, may need cleaning up and adjusting
	const getIframeSrcDoc = useCallback((id, code, isEditing) => {
		const trimmedCode = code.trim()
		const interactiveEditorScript = `
		<script>
		(function() {
			let selectedElement = null;
			let isResizing = false;
			let originalWidth, originalHeight, startX, startY;
			let editorActive = true;
	
			function createEditorControls() {
				const controls = document.createElement('div');
				controls.id = 'editor-controls';
				controls.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#333;padding:10px;border-radius:5px;z-index:9999;display:none;';
				const label = document.createElement('span');
				label.textContent = 'Style: ';
				label.style.color = 'white';
				const propertySelect = document.createElement('select');
				propertySelect.id = 'style-property';
				['color', 'backgroundColor'].forEach(prop => {
					const option = document.createElement('option');
					option.value = prop;
					option.textContent = prop;
					propertySelect.appendChild(option);
				});
				const colorInput = document.createElement('input');
				colorInput.type = 'color';
				colorInput.id = 'style-color';
				colorInput.onchange = function() {
					if (selectedElement) {
						const property = propertySelect.value;
						selectedElement.style[property] = this.value;
						sendHeight();
						parent.postMessage({
							action: 'editedContentReady',
							blockId: '${id}',
							editedContent: document.documentElement.outerHTML
						}, '*');
					}
				};
				const closeBtn = document.createElement('button');
				closeBtn.textContent = 'Close';
				closeBtn.style.marginLeft = '10px';
				closeBtn.onclick = () => { 
					controls.style.display = 'none'; 
					deselectElement(); 
				};
				controls.appendChild(label);
				controls.appendChild(propertySelect);
				controls.appendChild(colorInput);
				controls.appendChild(closeBtn);
				document.body.appendChild(controls);
				return controls;
			}
	
			function updateColorInputStyle(element) {
				const colorInput = document.getElementById('style-color');
				const property = document.getElementById('style-property')?.value || 'color';
				if (colorInput) {
					const computedStyle = window.getComputedStyle(element);
					colorInput.value = rgbToHex(computedStyle[property]);
				}
			}
	
			function createResizeHandles(element) {
				const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
				const container = document.createElement('div');
				container.className = 'resize-container';
				container.style.cssText = 'position:absolute;pointer-events:none;border:1px dashed blue;z-index:9998;';
				handles.forEach(pos => {
					const handle = document.createElement('div');
					handle.className = 'resize-handle ' + pos;
					handle.style.cssText = 'position:absolute;width:10px;height:10px;background:blue;border-radius:50%;z-index:10000;cursor:' + pos + '-resize;pointer-events:all;';
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
	
			function updateResizeContainer(element, container) {
				const rect = element.getBoundingClientRect();
				container.style.top = rect.top + 'px';
				container.style.left = rect.left + 'px';
				container.style.width = rect.width + 'px';
				container.style.height = rect.height + 'px';
			}
	
			function makeEditable(element) {
				if (!element) return;
				if (element.isContentEditable || 
					element.tagName === 'INPUT' || 
					element.tagName === 'TEXTAREA' ||
					element.tagName === 'SELECT') {
					return;
				}
				element.contentEditable = true;
				element.focus();
				updateColorInputStyle(element);
				element.addEventListener('blur', function onBlur() {
					element.contentEditable = false;
					element.removeEventListener('blur', onBlur);
					sendHeight();
					parent.postMessage({
						action: 'editedContentReady',
						blockId: '${id}',
						editedContent: document.documentElement.outerHTML
					}, '*');
				}, { once: true });
			}
	
			function selectElement(e) {
				if (!editorActive) return;
				if (e.target.id === 'editor-controls' || e.target.closest('#editor-controls')) return;
				if (e.target.className.includes('resize-handle')) return;
				deselectElement();
				selectedElement = e.target;
				if (selectedElement === document.body || selectedElement === document.documentElement) {
					selectedElement = null;
					return;
				}
				selectedElement.dataset.originalOutline = selectedElement.style.outline;
				selectedElement.style.outline = '2px solid blue';
				const controls = document.getElementById('editor-controls') || createEditorControls();
				controls.style.display = 'block';
				updateColorInputStyle(selectedElement);
				createResizeHandles(selectedElement);
				selectedElement.addEventListener('dblclick', function onDblClick(evt) {
					evt.stopPropagation();
					makeEditable(selectedElement);
				}, { once: true });
				e.stopPropagation();
			}
	
			function deselectElement() {
				if (!selectedElement) return;
				selectedElement.style.outline = selectedElement.dataset.originalOutline || '';
				delete selectedElement.dataset.originalOutline;
				selectedElement.contentEditable = false;
				const container = document.querySelector('.resize-container');
				if (container) container.remove();
				parent.postMessage({
					action: 'editedContentReady',
					blockId: '${id}',
					editedContent: document.documentElement.outerHTML
				}, '*');
				selectedElement = null;
			}
	
			function rgbToHex(rgb) {
				if (!rgb) return '#000000';
				if (rgb.startsWith('#')) return rgb;
				if (rgb.startsWith('rgba')) {
					const parts = rgb.match(/^rgba\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)$/);
					if (!parts) return '#000000';
					const r = parseInt(parts[1]).toString(16).padStart(2, '0');
					const g = parseInt(parts[2]).toString(16).padStart(2, '0');
					const b = parseInt(parts[3]).toString(16).padStart(2, '0');
					return '#' + r + g + b;
				}
				const parts = rgb.match(/^rgb\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)$/);
				if (!parts) return '#000000';
				const r = parseInt(parts[1]).toString(16).padStart(2, '0');
				const g = parseInt(parts[2]).toString(16).padStart(2, '0');
				const b = parseInt(parts[3]).toString(16).padStart(2, '0');
				return '#' + r + g + b;
			}
	
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
					if (resizePos.includes('e')) newWidth = originalWidth + deltaX;
					if (resizePos.includes('w')) newWidth = originalWidth - deltaX;
					if (resizePos.includes('s')) newHeight = originalHeight + deltaY;
					if (resizePos.includes('n')) newHeight = originalHeight - deltaY;
					if (newWidth > 10) selectedElement.style.width = newWidth + 'px';
					if (newHeight > 10) selectedElement.style.height = newHeight + 'px';
					const container = document.querySelector('.resize-container');
					updateResizeContainer(selectedElement, container);
					sendHeight();
				}
				function stopResize() {
					isResizing = false;
					document.removeEventListener('mousemove', doResize);
					document.removeEventListener('mouseup', stopResize);
					parent.postMessage({
						action: 'editedContentReady',
						blockId: '${id}',
						editedContent: document.documentElement.outerHTML
					}, '*');
				}
				document.addEventListener('mousemove', doResize);
				document.addEventListener('mouseup', stopResize);
				e.preventDefault();
			}
	
			function getEditedHTML() {
				return document.documentElement.outerHTML;
			}
	
			window.addEventListener('message', function(event) {
				if (event.data.action === 'getEditedContent') {
					parent.postMessage({
						action: 'editedContentReady',
						blockId: '${id}',
						editedContent: getEditedHTML()
					}, '*');
				}
			});
	
			function initEditor() {
				document.addEventListener('click', selectElement);
				document.addEventListener('keydown', function(e) {
					if (e.key === 'Escape') {
						deselectElement();
						const controls = document.getElementById('editor-controls');
						if (controls) controls.style.display = 'none';
					}
				});
			}
	
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
	
		const editorScripts = isEditing ? 
			interactiveEditorScript + scriptToInject : 
			scriptToInject;
	
		let srcDoc = '';
		if (/<html[\s>]/i.test(trimmedCode)) {
			if (/<\/body>/i.test(trimmedCode)) {
				srcDoc = trimmedCode.replace(/<\/body>/i, editorScripts + '</body>');
			} else {
				srcDoc = trimmedCode + editorScripts;
			}
		} else {
			srcDoc = `<!DOCTYPE html><html><head><style>html,body { margin:0; padding:0; }</style></head><body><div id="content">${code}</div>${editorScripts}</body></html>`;
		}
		return srcDoc;
	}, []);	

	useEffect(() => {
	function handleIframeMessage(event) {
		const { blockId, height, action, editedContent } = event.data;
		if (blockId && height) {
			const iframe = iframeRefs.current[blockId];
			if (iframe) iframe.style.height = `${height}px`;}
			if (action === 'editedContentReady' && blockId && editedContent) {
				let cleanedContent = editedContent;
				if (editedContent.includes('<html')) {
				  try {
					const parser = new DOMParser();
					const doc = parser.parseFromString(editedContent, 'text/html');
					const scripts = doc.querySelectorAll('script');
					scripts.forEach(script => {
					  //Only remove editor scripts, preserve user scripts
					  if (script.textContent.includes('editor-controls') || 
						  script.textContent.includes('resize-container') ||
						  script.textContent.includes('sendHeight')) {
						script.remove();
					  }
					});
					const editorElements = [
					  '#editor-controls',
					  '#toggle-editor', 
					  '#editor-instructions',
					  '.resize-container',
					  '.resize-handle'
					];
					editorElements.forEach(selector => {
					  const elements = doc.querySelectorAll(selector);
					  elements.forEach(el => el.remove());
					});
					const allElements = doc.querySelectorAll('*');
					allElements.forEach(el => {
					  if (el.hasAttribute('contenteditable')) {
						el.removeAttribute('contenteditable');
					  }
					  //Remove data attributes related to the editor
					  const attributesToRemove = [];
					  for (let i = 0; i < el.attributes.length; i++) {
						const attr = el.attributes[i];
						if (attr.name.startsWith('data-original') || 
							attr.name === 'data-mce-selected' ||
							attr.name.includes('editor')) {
						  attributesToRemove.push(attr.name);
						}
					  }
					  attributesToRemove.forEach(attr => el.removeAttribute(attr));
					});
					
					cleanedContent = '<!DOCTYPE html>\n<html>\n';
					cleanedContent += '<head>' + doc.head.innerHTML + '</head>\n';
					cleanedContent += '<body>';
					Array.from(doc.body.childNodes).forEach(node => {
					  if (!node.id || 
						  !['editor-controls', 'toggle-editor', 'editor-instructions'].includes(node.id)) {
						if (node.nodeType === Node.ELEMENT_NODE) {
						  cleanedContent += node.outerHTML;
						} else if (node.nodeType === Node.TEXT_NODE) {
						  cleanedContent += node.textContent;
						}
					  }
					});
					cleanedContent += '</body>\n</html>';
					cleanedContent = cleanedContent.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
				  } catch (err) {
					console.error("Error cleaning HTML content:", err);
				  }
				}
				setBlocks(prev => 
				  prev.map(block => 
					block.id === blockId
					  ? { ...block, data: { ...block.data, code: cleanedContent } }
					  : block
				  )
				);
			  }
	}
	
	window.addEventListener('message', handleIframeMessage);
	return () => window.removeEventListener('message', handleIframeMessage);
	}, []);

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

	const removeBlock = useCallback(blockId => {
		setBlocks(prev => prev.filter(block => block.id !== blockId))
		if (iframeRefs.current[blockId]) delete iframeRefs.current[blockId]
	}, [])

	const updateBlock = useCallback((updatedBlock) => {
		setBlocks((prev) => 
			prev.map((b) => {
				if (b.id === updatedBlock.id) {
					return { 
						...b, 
						data: {
						...b.data,
						...updatedBlock.data
						},
						isEditing: updatedBlock.isEditing !== undefined ? updatedBlock.isEditing : b.isEditing
					};
				}
				return b;
			})
		);
	}, []);

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
		  setTimeout(() => { setFormErrorMessage(''); }, 10000);
		  return;
		}
		try {
		  const prompt = block.data._tempAiPrompt || '';
		  if (!prompt.trim()) {
			setFormErrorMessage('Prompt cannot be empty.');
			setTimeout(() => { setFormErrorMessage(''); }, 5000);
			return;
		  }
		  updateBlock({ ...block, data: { ...block.data, isBlockLoading: true, _tempAiPrompt: '' } });
		  setFormErrorMessage('');
		  const response = await axios.post('/api/generate_content', { 
			currentCode: block.data.code, 
			parentCode: isReply ? post.content : null, 
			request: prompt, 
			senderId: user.user_id,
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
			  }, 
			  isEditing: false 
			});
		  } else {
			updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
			setFormErrorMessage('Error creating content.');
			setTimeout(() => { setFormErrorMessage(''); }, 5000);
		  }
		} catch {
		  updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
		  setFormErrorMessage('Error creating content.');
		  setTimeout(() => { setFormErrorMessage(''); }, 5000);
		}
	}, [hasMembership, post, updateBlock]);

	const handleGenerateFullContent = useCallback(async () => {
		if (limitReached) {
			setFormErrorMessage(hasMembership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
			setTimeout(() => { setFormErrorMessage(''); }, 10000);
			return;
		}
		try {
			const prompt = globalAiPrompt.trim()
			if (!prompt) {
				setFormErrorMessage('Prompt cannot be empty.')
				setTimeout(() => { setFormErrorMessage(''); }, 5000);
				return
			}
			setIsGlobalLoading(true)
			setFormErrorMessage('')
			const fullHTML = compileFinalHTML(blocks)
			const response = await axios.post('/api/generate_content', { currentCode: fullHTML, parentCode: isReply ? post.content : null, request: prompt, senderId: user.user_id })
			if (response.data && response.status === 201) {
				const { generatedContent } = response.data
				setBlocks([{ data: { code: generatedContent, isBlockLoading: false, showPrompt: true }, id: v4(), isEditing: false, type: BLOCK_TYPES.CODE }])
			} else setFormErrorMessage('Creation error.'); setTimeout(() => { setFormErrorMessage(''); }, 5000);
		} catch {
			setFormErrorMessage('Error creating content.')
			setTimeout(() => { setFormErrorMessage(''); }, 5000);
		} finally {
			setIsGlobalLoading(false)
		}
	}, [blocks, compileFinalHTML, globalAiPrompt, hasMembership, post])

	const handleSubmit = useCallback(async e => {
		e.preventDefault()
		if (isContentEmpty(blocks)) {
			setFormErrorMessage(isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.')
			setTimeout(() => { setFormErrorMessage(''); }, 5000);
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
			setTimeout(() => { setFormErrorMessage(''); }, 5000);
		}
	}, [blocks, compileFinalHTML, isContentEmpty, isEdit, isReply, channel_name, feed_name, navigate, onSubmit, post, setShowForm, title, urlPrefix])

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
																		<button className="small-icon" onClick={() => removeBlock(id)} title="Delete" type="button"><FaTrash /></button>
																	{type !== BLOCK_TYPES.MEDIA && (
																		<button className="small-icon" onClick={toggleEdit} title={isEditing ? 'Preview' : 'Edit'} type="button">{isEditing ? <FaEye /> : <FaEdit />}</button>
																	)}
																</div>
																{isEditing && type === BLOCK_TYPES.CODE && <p className="text16" style={{color: '#7b7b7b', marginLeft: '0px'}}>Click on elements to edit them (may be glitchy)</p>}
																<div style={{ position: 'relative' }}>
																	{type === BLOCK_TYPES.MEDIA && (
																		<button className="small-icon" onClick={() => toggleMediaAlignment(block)} title="Centre media" type="button"><FaAlignCenter /></button>
																	)}
																	{type === BLOCK_TYPES.CODE && (
																	<>
																		<button className="small-icon" onClick={() => setCodeBlockDropdown({...codeBlockDropdown, [id]: !codeBlockDropdown[id]})} type="button">
																			<FaEllipsisV /><p style={{ fontSize: '14px', margin: '0px'}}>Add content</p>
																		</button>
																		{codeBlockDropdown[id] && (
																		<div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: '25px', backgroundColor: 'white', boxShadow: '0px 0px 5px rgba(0,0,0,0.2)', zIndex: 10, borderRadius: '4px', padding: '5px' }}>
																			<button onClick={() => {setCodeBlockDropdown({...codeBlockDropdown, [id]: false}); addIframe(id);}} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px', border: 'none', background: 'none', cursor: 'pointer' }}>
																				<FaLink style={{ marginRight: '5px' }} /> Add Website Link
																			</button>
																			<button onClick={() => {setCodeBlockDropdown({...codeBlockDropdown, [id]: false});addSocialMedia(id);}} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px', border: 'none', background: 'none', cursor: 'pointer' }}>
																				<FaShareAlt style={{ marginRight: '5px' }} /> Insert Social Media Post
																			</button>
																		</div>
																		)}
																	</>
																	)}
																</div>
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
																				<textarea 
																					className="code-input" 
																					onChange={e => {
																						const newValue = e.target.value;
																						updateBlock({ 
																						id: block.id, 
																						data: { 
																							...data, 
																							code: newValue 
																						}
																						});
																					}} 
																					placeholder="Enter code..." 
																					value={data.code} 
																					/>
																			)}
																		</>
																	)}
																	{data.code.trim() ? (
																		<div className="code-preview">
																			<iframe ref={el => { iframeRefs.current[id] = el }} sandbox="allow-scripts allow-same-origin" srcDoc={getIframeSrcDoc(id, data.code, isEditing)} style={{ border: 'none', width: '100%', height: '0px' }} title={`code-preview-${id}`} />
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
												<iframe ref={el => { iframeRefs.current[block.id] = el }} sandbox="allow-scripts allow-same-origin" srcDoc={getIframeSrcDoc(block.id, data.code, false)} style={{ border: 'none', width: '100%', height: '0px' }} title={`live-preview-${i}`} />
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