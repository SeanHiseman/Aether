//This form needs splitting into multiple components, it's too long and complex
import axios from 'axios'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { useNavigate, useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { FaAlignCenter, FaArrowCircleUp, FaArrowRight, FaCircleNotch, FaCommentAlt, FaCrop, FaEdit, FaEllipsisV, FaEye, FaFont, FaLink, FaPhotoVideo, FaRegLightbulb, FaReply, FaSave, FaShareAlt, FaTerminal, FaTimes, FaToolbox, FaTrash, FaWindowClose } from 'react-icons/fa'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { v4 } from 'uuid'
import { AuthContext } from '../authContext'
import ContentWidget from './contentWidget'
import Cropper from 'react-easy-crop';
import GetCroppedImg from '../getCroppedImg'

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
            result.push({ data: { code, isBlockLoading: false, showPrompt: true }, id: blockId, isEditing: true, type: BLOCK_TYPES.CODE })
        } else if (blockClass.includes('text-block')) {
            result.push({ data: { html: content }, id: blockId, isEditing: true, type: BLOCK_TYPES.TEXT })
        } else if (blockClass.includes('media-block')) {
            const img = div.querySelector('img')
            const video = div.querySelector('video')
            const align = div.getAttribute('data-align') || 'center'
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
const ContentForm = ({ channelId, feed, isEdit = false, isGroup, isReply, onEditSubmit, onPostSubmit, post = null, postErrorMessage, setPostErrorMessage, setShowForm }) => {
    const [blocks, setBlocks] = useState([])
    const [codeBlockDropdown, setCodeBlockDropdown] = useState(false)
    const [editMode, setEditMode] = useState(true)
    const [blockLimitError, setBlockLimitError] = useState('')
    const [cropState, setCropState] = useState({});
    const [draftId, setDraftId] = useState(post?.draft_id || null)
    const [globalAiPrompt, setGlobalAiPrompt] = useState('')
    const [isGlobalLoading, setIsGlobalLoading] = useState(false)
    const [showGlobalAiPrompt, setShowGlobalAiPrompt] = useState(false)
    const [title, setTitle] = useState('')
    const iframeRefs = useRef({})
    const [isPostingDraft, setIsPostingDraft] = useState(false);
    const { channel_name, feed_name } = useParams()
    const navigate = useNavigate()
    const urlPrefix = isGroup ? 'g' : 'u'
    const { user, viewer } = useContext(AuthContext)
    const hasMembership = user?.has_membership
    const isDraft = Boolean(draftId)
    const BLOCK_LIMIT = hasMembership ? 10000 : 10
    const MAX_FILE_SIZE = hasMembership ? 100 * 1024 * 1024 : 1 * 1024 * 1024
    const TEXT_CHAR_LIMIT = hasMembership ? 100000 : 1000
    const TITLE_CHAR_LIMIT = hasMembership ? 1000 : 100
    const usageLimit = user.has_membership ? 25000000 : 2500000
    const limitReached = user.usage_count >= usageLimit

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
        const input = prompt('Enter the social media embed code or URL:');
        if (!input) return;
        const updatedBlocks = blocks.map(block => {
            if (block.id !== blockId || block.type !== BLOCK_TYPES.CODE) {
                return block;
            }
            let embedCode = input.trim();
            if (embedCode.startsWith('http') && !embedCode.includes('<')) {
                try {
                    const parsed = new URL(embedCode);
                    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                        alert('Please enter a valid http or https URL');
                        return block;
                    }
                    embedCode = `<a href="${parsed.href}" target="_blank" rel="noopener noreferrer">${parsed.href}</a>`;
                }
                catch (e) {
                    alert('Please enter a valid URL or embed code');
                    return block;
                }
            }
            if (!embedCode.startsWith('<div class="social-media-embed"')) {
                embedCode =
                `<div class="social-media-embed" ` +
                `style="width:100%;display:flex;justify-content:center;overflow:hidden;">` +
                    embedCode +
                `</div>`;
            }
            return {
                ...block,
                data: {
                ...block.data,
                code: block.data.code
                    ? block.data.code + '\n\n' + embedCode
                    : embedCode
                }
            };
        });
        setBlocks(updatedBlocks);
    };

    const applyCrop = useCallback(async (blockId) => {
        const blockCropState = cropState[blockId];
        if (!blockCropState || !blockCropState.croppedAreaPixels) return;
        try {
            const block = blocks.find(b => b.id === blockId);
            if (!block || !block.data.isImage) return;
            const croppedBlob = await GetCroppedImg(block.data.url, blockCropState.croppedAreaPixels);
            const croppedUrl = URL.createObjectURL(croppedBlob);
            const filename = `cropped-${Date.now()}.jpg`;
            const croppedFile = new File([croppedBlob], filename, { type: 'image/jpeg' });
            updateBlock({
                    id: blockId,
                    data: {
                    ...block.data,
                    file: croppedFile,
                    url: croppedUrl
                }
            });
            setCropState(prev => {
                const newState = { ...prev };
                delete newState[blockId];
                return newState;
            });
        } catch (error) {
          setPostErrorMessage('Failed to crop image. Please try again.');
        }
    }, [blocks, cropState, updateBlock, setPostErrorMessage]);

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

    const deleteHandler = useCallback(async () => {
        if (isDraft && !draftId) return
        if (!isDraft && !post) return
        if (!window.confirm(`Are you sure you want to delete this ${isDraft ? 'Draft' : 'Post'}?`)) return
        try {
            if (isDraft) {
                await axios.delete('/api/remove_draft', {
                    data: { draft: { draft_id: draftId } },
                })
                setDraftId(null)
                setPostErrorMessage('Draft deleted')
            } else {
                await axios.delete('/api/remove_post', {
                    data: {
                        post: {
                            post_id: post.post_id,
                            parent_id: post.parent_id,
                        },
                    },
                })
                setPostErrorMessage('Post deleted')
                navigate(`/${urlPrefix}/${feed_name}/${channel_name}`)
            }
            setShowForm(false)
            setTimeout(() => setPostErrorMessage(''), 3000)
        } catch (err) {
            setPostErrorMessage(`Error deleting ${isDraft ? 'draft' : 'post'}`)
            setTimeout(() => setPostErrorMessage(''), 3000)
        }
    }, [channel_name, draftId, feed_name, isDraft, navigate, post, setDraftId, setShowForm, setPostErrorMessage, urlPrefix,])  

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
                        setPostErrorMessage("Error cleaning content");
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
            setPostErrorMessage(hasMembership ? `These files exceed your max size limit: ${names}.` : `These files exceed your max size limit: ${names}. Get membership for more.`);
            return
        }
        setPostErrorMessage('')
        const canFitCount = Math.max(0, BLOCK_LIMIT - blocks.length)
        const fittingFiles = hasMembership ? files : files.slice(0, canFitCount)
        const uniqueFiles = fittingFiles.map(file => {
            const ext = file.name.substring(file.name.lastIndexOf('.'))
            const uniqueName = `${Date.now()}-${v4()}${ext}`
            return new File([file], uniqueName, { type: file.type })
        })
        const mediaBlocks = uniqueFiles.map(file => ({
            data: { file, fileType: file.type, isImage: file.type.startsWith('image/'), isVideo: file.type.startsWith('video/'), url: URL.createObjectURL(file), align: 'center' },
            id: v4(),
            isEditing: false,
            type: BLOCK_TYPES.MEDIA
        }))
        setBlocks(prev => [...prev, ...mediaBlocks])
    }, [MAX_FILE_SIZE, BLOCK_LIMIT, blocks.length, hasMembership])

    const onDragEnd = useCallback(result => {
        const { destination, source } = result
        if (!destination) return
        if (destination.index === source.index) return
        setBlocks(prev => reorder(prev, source.index, destination.index))
    }, [])

    const handleGenerateCodeBlock = useCallback(async block => {
        if (limitReached) {
          setPostErrorMessage(hasMembership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
          setTimeout(() => { setPostErrorMessage(''); }, 10000);
          return;
        }
        try {
          const prompt = block.data._tempAiPrompt || '';
          if (!prompt.trim()) {
            setPostErrorMessage('Prompt cannot be empty.');
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
            return;
          }
          updateBlock({ ...block, data: { ...block.data, isBlockLoading: true, _tempAiPrompt: '' } });
          setPostErrorMessage('');
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
            setPostErrorMessage('Error creating content.');
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
          }
        } catch {
          updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
          setPostErrorMessage('Error creating content.');
          setTimeout(() => { setPostErrorMessage(''); }, 5000);
        }
    }, [hasMembership, post, updateBlock]);

    const handleGenerateFullContent = useCallback(async () => {
        if (limitReached) {
            setPostErrorMessage(hasMembership ? "Usage limit reached" : "Usage limit reached. Get membership for more.");
            setTimeout(() => { setPostErrorMessage(''); }, 10000);
            return;
        }
        try {
            const prompt = globalAiPrompt.trim()
            if (!prompt) {
                setPostErrorMessage('Prompt cannot be empty.')
                setTimeout(() => { setPostErrorMessage(''); }, 5000);
                return
            }
            setIsGlobalLoading(true)
            setPostErrorMessage('')
            const fullHTML = compileFinalHTML(blocks)
            const response = await axios.post('/api/generate_content', { currentCode: fullHTML, parentCode: isReply ? post.content : null, request: prompt, senderId: user.user_id })
            if (response.data && response.status === 201) {
                const { generatedContent } = response.data
                setBlocks([{ data: { code: generatedContent, isBlockLoading: false, showPrompt: true }, id: v4(), isEditing: false, type: BLOCK_TYPES.CODE }])
            } else setPostErrorMessage('Creation error.'); setTimeout(() => { setPostErrorMessage(''); }, 5000);
        } catch {
            setPostErrorMessage('Error creating content.')
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
        } finally {
            setIsGlobalLoading(false)
        }
    }, [blocks, compileFinalHTML, globalAiPrompt, hasMembership, post])

    const handleSubmit = useCallback(async e => {
        e.preventDefault()
        if (isContentEmpty(blocks)) {
            setPostErrorMessage(isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.')
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
            return
        }
        try {
            const finalHTML = compileFinalHTML(blocks)
            const formData = new FormData()
            let postId
            if (!isEdit || isDraft) {
                postId = v4()
                formData.append('post_id', postId)
            } else postId = post.post_id
            formData.append('content', finalHTML)
            formData.append('feed_id', feed.feed_id);
            if (!post || draftId) { 
                formData.append('draft_id', draftId);
            } 
            if (isReply && post) formData.append('parent_id', post.post_id)
            if (!isReply) formData.append('title', title)
            if (channelId) formData.append('channel_id', channelId)
            blocks.filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.file).forEach(mediaBlock => formData.append('files', mediaBlock.data.file))
            await (isEdit && !isPostingDraft ? onEditSubmit(formData) : onPostSubmit(formData));
            setIsPostingDraft(false);
            setTitle('')
            setBlocks([])
            setGlobalAiPrompt('')
            setShowForm(false)
            setPostErrorMessage('')
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/${isReply ? post.post_id : postId}`)
        } catch (error) {
            setPostErrorMessage('Error submitting the form.')
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
        }
    }, [blocks, compileFinalHTML, draftId, isContentEmpty, isEdit, isPostingDraft, isReply, channel_name, feed_name, navigate, onEditSubmit, onPostSubmit, post, setShowForm, title, urlPrefix])

    const onCropComplete = useCallback((blockId, croppedAreaPixels) => {
        setCropState(prev => ({
            ...prev,
            [blockId]: {
                ...prev[blockId],
                croppedAreaPixels  
            }
        }));
    }, []);

    const removeBlock = useCallback(blockId => {
        setBlocks(prev => prev.filter(block => block.id !== blockId))
        if (iframeRefs.current[blockId]) delete iframeRefs.current[blockId]
    }, [])

    const saveDraft = useCallback(async e => {
        e.preventDefault();
        if (isContentEmpty(blocks)) {
            setPostErrorMessage(
                isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.'
            );
            setTimeout(() => setPostErrorMessage(''), 5000);
            return;
        }
        const finalHTML = compileFinalHTML(blocks);
        const formData = new FormData();
        formData.append('content', finalHTML);
        if (!isReply) formData.append('title', title);
        if (isReply && post) formData.append('parent_id', post.post_id);
        blocks
            .filter(b => b.type==='MEDIA' && b.data.file)
            .forEach(b => formData.append('files', b.data.file));
        formData.append('feed_id',   feed.feed_id);
        formData.append('channel_id',channelId);
        formData.append('poster_id', viewer.feed_id);
        let id = draftId;
        if (!id) {
            id = v4();
            setDraftId(id);
        }
        formData.append('draft_id', id);
        try {
            const response = await axios.post('/api/create_draft', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            if (response.data.success) {
                setPostErrorMessage('Draft saved');
                setTimeout(() => setPostErrorMessage(''), 3000);
                const [savedDraft] = response.data.draft;
                setDraftId(savedDraft.draft_id);
            }
        }
        catch (error) {
            setPostErrorMessage('Error saving draft.');
            setTimeout(() => setPostErrorMessage(''), 5000);
        }
    }, [blocks, compileFinalHTML, draftId, isContentEmpty, isReply, post, title, feed, channelId, viewer]);

    const toggleMediaAlignment = useCallback(block => {
        let newAlign;
        if (block.data.align === 'center') newAlign = 'left' 
        else if (block.data.align === 'left') newAlign = 'center' 
        else newAlign = 'center'
        updateBlock({ ...block, data: { ...block.data, align: newAlign } })
    }, [updateBlock])

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
                    <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', position: 'relative' }}>
                        <div className="left-buttons" style={{ display: 'flex', gap: '10px' }}>
                            <button className="small-icon" type="button" onClick={() => setShowForm(false)} title="Close">
                                <FaWindowClose />
                            </button>
                            {!isReply && (
                                <button className="small-icon" type="button" onClick={deleteHandler} title={isDraft ? 'Delete draft' : isEdit ? 'Delete post' : 'Delete'}>
                                    <FaTrash />
                                </button>
                            )}
                            {isReply ? (
                                <button className="small-icon" form="post-form" type="submit" title="Reply">
                                    <FaReply />
                                </button>
                            ) : isEdit && !isDraft ? (
                                <button className="small-icon" form="post-form" type="submit" title="Save edit">
                                    <FaSave />
                                </button>

                            ) : (
                                <>
                                    <button className="small-icon" type="button" onClick={saveDraft} title="Save draft">
                                        <FaSave />
                                    </button>
                                    <button className="small-icon" form="post-form" type="submit" title="Post" onClick={() => setIsPostingDraft(true)}>
                                        <FaArrowRight />
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="center-buttons" style={{ display: 'flex', gap: '10px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                            {!showGlobalAiPrompt ? (
                                <button className="small-icon" type="button" onClick={() => setShowGlobalAiPrompt(true)} title="Assistance">
                                    <FaRegLightbulb />
                                </button>
                            ) : (
                                <button className="small-icon" type="button" onClick={() => setShowGlobalAiPrompt(false)} title="Hide assistance">
                                    <FaTimes />
                                </button>
                            )}
                            <button className="small-icon" type="button" onClick={() => setEditMode(!editMode)} title={editMode ? 'Preview' : 'Edit'}>
                                {editMode ? <FaEye /> : <FaEdit />}
                            </button>
                        </div>
                        {editMode && (
                            <div className="right-buttons" style={{ display: 'flex', gap: '10px', position: 'absolute', right: '0' }}>
                                <button className="small-icon" type="button" onClick={() => handleAddBlock(BLOCK_TYPES.TEXT)} title="Add text">
                                    <FaFont />
                                </button>
                                <label htmlFor="media-input" className="small-icon" title="Add media">
                                    <FaPhotoVideo />
                                </label>
                                <button className="small-icon" type="button" onClick={() => handleAddBlock(BLOCK_TYPES.CODE)} title="Add custom">
                                    <FaToolbox />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {(blockLimitError || postErrorMessage) && (
                    <p className="text16" style={{ display: 'flex', alignItems: 'center', margin: '0' }}>
                        {blockLimitError || postErrorMessage}
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
                                setPostErrorMessage('');
                            } else {
                                setPostErrorMessage('Title exceeds character limit.', !user.has_membership && 'Get membership for more.');
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
                                    setPostErrorMessage('');
                                } else {
                                    setPostErrorMessage('Prompt exceeds character limit.', !user.has_membership && 'Get membership for more.');
                                }
                            }}
                            placeholder={limitReached ? user.has_membership ? "Usage limit reached. Buy new membership to reset" : "Usage limit reached. Get membership for more." : "Describe changes for post..."} 
                            value={globalAiPrompt}/>
                        <button className={isGlobalLoading || !globalAiPrompt.trim() || limitReached ? 'large-icon disabled' : 'large-icon'} 
                            disabled={isGlobalLoading || !globalAiPrompt.trim() || limitReached} 
                            onClick={handleGenerateFullContent} 
                            title={limitReached ? "Usage limit reached" : isGlobalLoading ? 'Creating...' : !globalAiPrompt.trim() ? 'Enter a prompt' : 'Create'} 
                            type="button">
                            {isGlobalLoading ? <FaCircleNotch className="spinner" /> : <FaArrowCircleUp />}
                        </button>
                    </div>
                )}
                <input accept="image/*,video/*" hidden id="media-input" multiple onChange={handleFilesChange} type="file" />
                {editMode && 
                    <div style={{width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <p className="text24" style={{marginLeft: 0, marginTop: 0}}>{isReply ? 'Reply' : 'Editing'}</p>
                        <p className="text16 faded-text">Drag and drop blocks to reorder</p>
                    </div>
                }
                <div className={editMode ? 'single-container edit' : 'single-container'}>
                    {editMode ? (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="blocks-droppable">
                                {provided => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {!blocks.length && <p className="text24 faded-text">Add content using the buttons above</p>}
                                        {blocks.map((block, index) => {
                                            const { data, id, isEditing, type } = block
                                            const toggleEdit = () => updateBlock({ ...block, isEditing: !isEditing })
                                            return (
                                                <Draggable key={id} draggableId={id} index={index} isDragDisabled={cropState[id]?.isCropping}>
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
                                                                {isEditing && type === BLOCK_TYPES.CODE && <p className="text16 faded-text">Click on elements to edit them (may be glitchy)</p>}
                                                                <div style={{ position: 'relative' }}>
                                                                {type === BLOCK_TYPES.MEDIA && (
                                                                    <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
                                                                        {data.isImage && (
                                                                        <button 
                                                                            className="small-icon" 
                                                                            onClick={() => setCropState(prev => ({
                                                                            ...prev,
                                                                            [id]: {
                                                                                isCropping: true,
                                                                                crop: { x: 0, y: 0 },
                                                                                zoom: 1,
                                                                                croppedAreaPixels: null
                                                                            }
                                                                            }))} 
                                                                            title="Crop image" 
                                                                            type="button"
                                                                        >
                                                                            <FaCrop /><p className="icon-text">Crop</p>
                                                                        </button>
                                                                        )}
                                                                        <button className="small-icon" onClick={() => toggleMediaAlignment(block)} title={block.data.align === 'center' ? "Align left" : "Align centre"} type="button">
                                                                            <FaAlignCenter />
                                                                        </button>
                                                                    </div>
                                                                    )}
                                                                    {type === BLOCK_TYPES.CODE && (
                                                                    <>
                                                                        <button className="small-icon" onClick={() => setCodeBlockDropdown({...codeBlockDropdown, [id]: !codeBlockDropdown[id]})} type="button">
                                                                            <FaEllipsisV /><p style={{ fontSize: '14px', margin: '0px'}}>Add content</p>
                                                                        </button>
                                                                        {codeBlockDropdown[id] && (
                                                                        <div className="dropdown-menu">
                                                                            <button className="small-icon" onClick={() => {setCodeBlockDropdown({...codeBlockDropdown, [id]: false}); addIframe(id);}}>
                                                                                <FaLink /><p className="icon-text">Add website link</p>
                                                                            </button>
                                                                            <button className="small-icon" onClick={() => {setCodeBlockDropdown({...codeBlockDropdown, [id]: false});addSocialMedia(id);}}>
                                                                                <FaShareAlt /><p className="icon-text">Insert Social Media Post</p>
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
                                                                                                setPostErrorMessage('');
                                                                                            } else {
                                                                                                updateBlock({ ...block, data: { ...data, _tempAiPrompt: input } });
                                                                                                setPostErrorMessage('Prompt exceeds character limit.', !user.has_membership && 'Get membership for more.');
                                                                                            }
                                                                                        }}
                                                                                        placeholder={limitReached ? (user.has_membership ? "Usage limit reached. Buy new membership to reset" 
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
                                                                    {cropState[id]?.isCropping && data.isImage ? (
                                                                        <div>
                                                                            <div className="crop-container" style={{ position: 'relative', width: '100%', height: 300 }}>
                                                                                <Cropper
                                                                                    image={data.url}
                                                                                    crop={cropState[id]?.crop || { x: 0, y: 0 }}
                                                                                    zoom={cropState[id]?.zoom || 1}
                                                                                    aspect={4/3}
                                                                                    onCropChange={(crop) => setCropState(prev => ({
                                                                                        ...prev,
                                                                                        [id]: {
                                                                                            ...prev[id],
                                                                                            crop
                                                                                        }
                                                                                    }))}
                                                                                    onCropComplete={(_, croppedPixels) => onCropComplete(id, croppedPixels)}
                                                                                    onZoomChange={(zoom) => setCropState(prev => ({
                                                                                        ...prev,
                                                                                        [id]: {
                                                                                            ...prev[id],
                                                                                            zoom
                                                                                        }
                                                                                    }))}
                                                                                    onInteractionStart={() => {}}
                                                                                />
                                                                            </div>
                                                                            <div className="crop-controls" style={{ display: 'flex', justifyContent: 'center', marginTop: 10, gap: 10 }}>
                                                                                <button 
                                                                                    className="small-icon"
                                                                                    onClick={() => setCropState(prev => {
                                                                                        const newState = { ...prev };
                                                                                        delete newState[id];
                                                                                        return newState;
                                                                                    })}
                                                                                    title="Cancel" 
                                                                                    type="button"
                                                                                >
                                                                                    <FaTimes /><p className="icon-text">Cancel</p>
                                                                                </button>
                                                                                <button className="small-icon" onClick={() => applyCrop(id)} title="Apply Crop" type="button">
                                                                                    <FaSave /><p className="icon-text">Apply</p>
                                                                                </button>
                                                                        </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {data.isImage ? (
                                                                    <img alt="Uploaded Media" src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
                                                                    ) : data.isVideo ? (
                                                                        <video controls src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' } : { maxWidth: '100%', height: 'auto' }} />
                                                                    ) : (
                                                                        <p>Unsupported</p>
                                                                    )}
                                                                </>
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
    onEditSubmit: PropTypes.func,
    onPostSubmit: PropTypes.func,
    post: PropTypes.object,
    setShowForm: PropTypes.func,
}

export default ContentForm;