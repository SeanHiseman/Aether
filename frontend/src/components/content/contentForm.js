import api from '../../api';
import { AuthContext } from '../authContext'
import { Crown } from 'lucide-react';
import ConfirmModal from '../modals/confirmModal';
import ContentWidget from './contentWidget'
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { FaAlignCenter, FaArrowCircleUp, FaArrowRight, FaCircleNotch, FaCommentAlt, FaCopy, FaCube, FaCrop, FaEdit, FaEllipsisV, FaEye, FaFileAlt, FaFont, FaGripVertical, FaImage, FaReply, FaSave, FaTerminal, FaTimes, FaToolbox, FaTrash, FaVideo } from 'react-icons/fa'
import GetCroppedImg from '../../functions/getCroppedImg';
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactQuill from 'react-quill'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { v4 } from 'uuid'
import 'react-quill/dist/quill.snow.css'

const BLOCK_TYPES = { APP: 'APP', CODE: 'CODE', MEDIA: 'MEDIA', TEXT: 'TEXT' }

//Split compiled post into content blocks
const parseContentBlocks = htmlString => {
	const doc = new DOMParser().parseFromString(htmlString || '', 'text/html')
	const divs = doc.querySelectorAll('div.content-block')
	const result = []
	divs.forEach(div => {
		const blockClass = div.className
		const blockId = div.getAttribute('data-blockid')
		const content = div.innerHTML.trim()
		if (div.classList.contains('app-block')) {
			result.push({
				data: {
					appPath: div.getAttribute('data-apppath'),
					buildId: div.getAttribute('data-buildid'),
					kind: div.getAttribute('data-kind')
				},
				id: blockId,
				isEditing: false,
				type: BLOCK_TYPES.APP
			})
        } else if (blockClass.includes('code-block')) {
            const code = div.getAttribute('data-code') || content || ''
            result.push({
                data: {
                    code,
                    isBlockLoading: false,
                    showPrompt: true
                },
                id: blockId,
                isEditing: true,
                type: BLOCK_TYPES.CODE
            })
        } else if (blockClass.includes('text-block')) {
			result.push({
				data: { html: content },
				id: blockId,
				isEditing: true,
				type: BLOCK_TYPES.TEXT
			})
		} else if (blockClass.includes('media-block')) {
			const align = div.getAttribute('data-align') || 'center'
			const img = div.querySelector('img')
			const video = div.querySelector('video')
			if (img) {
				result.push({
					data: {
						align,
						file: null,
						fileType: 'image/*',
						isImage: true,
						isVideo: false,
						url: img.getAttribute('src')
					},
					id: blockId,
					isEditing: true,
					type: BLOCK_TYPES.MEDIA
				})
			} else if (video) {
				const source = video.querySelector('source')
				result.push({
					data: {
						align,
                        duration: video.getAttribute('data-duration') || null,
						file: null,
						fileType: source?.getAttribute('type') || '',
						isImage: false,
						isVideo: true,
						url: source?.getAttribute('src') || ''
					},
					id: blockId,
					isEditing: true,
					type: BLOCK_TYPES.MEDIA
				})
			} else {
				result.push({
					data: {
						align,
						file: null,
						fileType: '',
						isImage: false,
						isVideo: false,
						url: ''
					},
					id: blockId,
					isEditing: true,
					type: BLOCK_TYPES.MEDIA
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

//Post is either the post being edited or replied to
const ContentForm = ({ channelId, feed, isEdit = false, isGroup, isReply, onPostDelete, onPostSubmit, parentPost = null, post = null, postErrorMessage, setPostErrorMessage, setShowForm }) => {
    const [addContentDropdownOpen, setAddContentDropdownOpen] = useState(false)
    const blocksRef = useRef([]) 
    const [blocks, setBlocks] = useState([])
    const [blockLimitError, setBlockLimitError] = useState('')
    const { channel_name, feed_name } = useParams()
    const [cropState, setCropState] = useState({})
    const [draftId, setDraftId] = useState(post?.draft_id || null)
    const { isAuthenticated, user, viewer } = useContext(AuthContext)
    const hasMembership = user?.has_membership
    const isDraft = Boolean(draftId)
    const cropImageRefs = useRef({})
    const iframeRefs = useRef({})
    const [isPostingDraft, setIsPostingDraft] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const navigate = useNavigate()
    const submittedRef = useRef(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [pendingDeleteAction, setPendingDeleteAction] = useState(null)
    const [title, setTitle] = useState('')
    const urlPrefix = isGroup ? 'g' : 'u'

    const BLOCK_LIMIT = hasMembership ? 10000 : 10
    const MAX_FILE_SIZE = hasMembership ? 500 * 1024 * 1024 : 5 * 1024 * 1024 //500MB for members, 5MB for non-members
    const MAX_VIDEO_SIZE = hasMembership ? 10000 * 1024 * 1024 : 100 * 1024 * 1024 //10GB for members, 100MB for non-members
    const TEXT_CHAR_LIMIT = hasMembership ? 100000 : 1000
    const TITLE_CHAR_LIMIT = hasMembership ? 1000 : 100
    const usageLimit = user?.has_membership ? 25000000 : 2500000 //Token generation limit
    const limitReached = user?.usage_count >= usageLimit
    const previewPost = isEdit && isReply ? parentPost : post;

    useEffect(() => {
        if (!isAuthenticated && post?.post_id) {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}/${post.id}`)
        } else if (!isAuthenticated) {
            navigate(`/${urlPrefix}/${feed_name}/${channel_name}`)
        }
    }, [isAuthenticated, navigate, urlPrefix, feed_name, channel_name, post?.id])

    const appFileChange = useCallback(async e => {
        const blockId  = v4()
        const file     = e.target.files[0]
        const formData = new FormData()
        setBlocks(prev => [
            ...prev, { 
                id: blockId,
                isEditing: false,
                type: BLOCK_TYPES.APP,
                data: {
                    fileName: file.name,
                    isUploading: true
                }
            }
        ])
        formData.append('build', file)
        try {
            const { data } = await api.post('/upload_build', formData)
            if (data.success) {
                updateBlock({
                    id: blockId,
                    isEditing: false,
                    type: BLOCK_TYPES.APP,
                    data: {
                        appPath: data.path,
                        buildId: data.buildId,
                        isUploading: false,
                        kind: data.kind
                    }
                })
            } else {
                setPostErrorMessage('App upload failed.')
                setTimeout(() => setPostErrorMessage(''), 5000)
            }
        } catch (error) {
            setPostErrorMessage(error.response?.data?.message || 'App upload failed.')
            setTimeout(() => setPostErrorMessage(''), 5000)
        }
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

    const applyCrop = useCallback(async (blockId) => {
        const blockCropState = cropState[blockId];
        if (!blockCropState || !blockCropState.crop) {
            setPostErrorMessage('Please draw a crop selection first.');
            setTimeout(() => setPostErrorMessage(''), 3000);
            return;
        }
        try {
            const block = blocks.find(b => b.id === blockId);
            if (!block || !block.data.isImage) return;
            const { crop } = blockCropState;
            const imageRef = cropImageRefs.current[blockId];
            if (!imageRef) {
                setPostErrorMessage('Image reference not found. Please try again.');
                setTimeout(() => setPostErrorMessage(''), 3000);
                return;
            }
            if (!crop.width || !crop.height) {
                setPostErrorMessage('Please draw a crop selection first.');
                setTimeout(() => setPostErrorMessage(''), 3000);
                return;
            }
            //Convert displayed pixel crop to natural image dimensions
            const scaleX = imageRef.naturalWidth / imageRef.width;
            const scaleY = imageRef.naturalHeight / imageRef.height;
            const pixelCrop = {
                x: crop.x * scaleX,
                y: crop.y * scaleY,
                width: crop.width * scaleX,
                height: crop.height * scaleY
            };
            const croppedBlob = await GetCroppedImg(block.data.url, pixelCrop);
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
            setPostErrorMessage(error.response?.data?.message || 'Failed to crop image. Please try again.');
            setTimeout(() => setPostErrorMessage(''), 5000)
        }
    }, [blocks, cropState, updateBlock, setPostErrorMessage]);

    //Remove uploaded builds if form is closed without posting or saving, or if a block is deleted
    useEffect(() => {
        return () => {
            if (!draftId && !isEdit && !submittedRef.current) {
                (async () => {
                    for (const b of blocksRef.current) {
                        if (b.type === BLOCK_TYPES.APP && b.data.buildId) {
                            try {
                                await api.delete('/remove_build', {
                                    data: { buildId: b.data.buildId },
                                })
                            } catch {}
                        }
                    }
                })()
            }
        }
    }, [])

    //Ensure unused app builds are removed when the form is closed
    useEffect(() => {
        blocksRef.current = blocks
    }, [blocks])

    const closeForm = () => {
        if (isSubmitting) {
            const confirmClose = window.confirm('Your post is still uploading. Do you want to close anyway?');
            if (!confirmClose) return;
        }
        if (!draftId && !isEdit && !submittedRef.current) {
            blocksRef.current.forEach(b => {
                if (b.type === BLOCK_TYPES.APP && b.data.buildId) {
                    api.delete('/remove_build', { data: { buildId: b.data.buildId } })
                        .catch(()=>{});
                }
            });
        }
        setShowForm(false);
    };

    const compileFinalHTML = useCallback(allBlocks => {
        let finalHTML = ''
        allBlocks
            .filter(block => {
                if (block.type === BLOCK_TYPES.TEXT) return block.data.html?.trim()
                if (block.type === BLOCK_TYPES.CODE) return block.data.code?.trim()
                if (block.type === BLOCK_TYPES.MEDIA) return block.data.url?.trim()
                if (block.type === BLOCK_TYPES.APP) return true
                return false
            })
            .forEach(block => {
                if (block.type === BLOCK_TYPES.TEXT) {
                    finalHTML +=
                        `<div class="content-block text-block"` +
                        ` data-blockid="${block.id}">` +
                        `${block.data.html || 'Nothing to preview'}` +
                        `</div>`
                }
                else if (block.type === BLOCK_TYPES.CODE) {
                    finalHTML +=
                        `<div class="content-block code-block"` +
                        ` data-blockid="${block.id}">` +
                        `${block.data.code || ''}` +
                        `</div>`;
                }
                else if (block.type === BLOCK_TYPES.MEDIA) {
                    const { align, url, fileType, isImage, isVideo } = block.data
                    if (isImage) {
                        finalHTML +=
                            `<div class="content-block media-block"` +
                            ` data-blockid="${block.id}"` +
                            ` data-align="${align}">` +
                            `<img src="${url}" alt="Uploaded image"` +
                            ` style="max-width:100%;height:auto;display:${align==='center'?'block':'inline'};margin:${align==='center'?'0 auto':''}" />` +
                            `</div>`
                    }
                    else if (isVideo) {
                        finalHTML +=
                            `<div class="content-block media-block"` +
                            ` data-blockid="${block.id}"` +
                            ` data-align="${align}">` +
                            `<video controls` +
                            `${block.data.duration ? ` data-duration="${block.data.duration}"` : ''}` +
                            ` style="max-width:100%;height:auto;display:${align==='center'?'block':'inline'};margin:${align==='center'?'0 auto':''}">` +
                            `<source src="${url}" type="${fileType}" />` +
                            `</video></div>`
                    }
                    else {
                        finalHTML +=
                            `<div class="content-block media-block"` +
                            ` data-blockid="${block.id}"` +
                            ` data-align="${align}">Unsupported</div>`
                    }
                }
                else if (block.type === BLOCK_TYPES.APP) {
                    const { appPath, buildId, kind } = block.data
                    finalHTML +=
                        `<div class="content-block app-block"` +
                        ` data-apppath="${appPath}"` +
                        ` data-blockid="${block.id}"` +
                        ` data-buildid="${buildId}"` +
                        ` data-kind="${kind}"></div>`
                }
            })
        return finalHTML
    }, [])

    const cancelDelete = () => {
		setShowDeleteConfirm(false);
		setPendingDeleteAction(null);
	};

	const deleteClick = () => {
		const item = isReply ? "reply" : isDraft ? "draft" : "post";
		setPendingDeleteAction(item);
		setShowDeleteConfirm(true);
	};

    const confirmDelete = useCallback(async () => {
        if (!isAuthenticated) return;
        if (isDraft && !draftId) return;
        if (!isDraft && !post) return;
        setShowDeleteConfirm(false);
        try {
            if (isDraft) {
                await api.delete('/remove_draft', {
                    data: { draft: { draft_id: draftId } },
                });
                setDraftId(null);
                setPostErrorMessage('Draft deleted');
                navigate(`/${urlPrefix}/${feed_name}/${channel_name}`);
            } else {
                await api.delete('/remove_post', {
                    data: {
                        post: { post_id: post?.post_id, parent_id: post?.parent_id },
                    },
                });
                const navigateUrl = isReply ? `/${urlPrefix}/${feed_name}/${channel_name}/${post?.post_id}` : `/${urlPrefix}/${feed_name}/${channel_name}`;
                navigate(navigateUrl);
                if (onPostDelete) onPostDelete();
            }
            setTimeout(() => setPostErrorMessage(''), 3000);
        } catch (error) {
            setPostErrorMessage(error.response?.data?.message || `Error deleting ${isDraft ? 'draft' : 'post'}`);
            setTimeout(() => setPostErrorMessage(''), 3000);
        }
        setPendingDeleteAction(null);
    }, [channel_name, draftId, feed_name, isDraft, navigate, post, setDraftId, setShowForm, setPostErrorMessage, urlPrefix]);

    const isContentEmpty = useCallback(blocksArray => !blocksArray.some(block => {
        if (block.type === BLOCK_TYPES.TEXT) return block.data.html && block.data.html.trim() !== ''
        if (block.type === BLOCK_TYPES.CODE) return block.data.code && block.data.code.trim() !== ''
        if (block.type === BLOCK_TYPES.MEDIA) return block.data.url && block.data.url.trim() !== ''
        if (block.type === BLOCK_TYPES.APP) return true
        return false
    }), [])

    //Get content blocks from post url
    useEffect(() => {
        async function fetchAndSetBlocks() { 
            if (isEdit && post) {
                setTitle(post?.title || '')
                //Check if post.content is a path to html file
                if (typeof post?.content === 'string' && post?.content.endsWith('.html')) {
                    try {
                        const res = await fetch(post?.content) //Get raw HTML from URL
                        const html = await res.text()
                        const existingBlocks = parseContentBlocks(html) //parse fetched HTML
                        if (existingBlocks.length) setBlocks(existingBlocks)
                        else setBlocks([{ data: { html }, id: v4(), isEditing: true, type: BLOCK_TYPES.TEXT }])
                    } catch (error) {
                        setPostErrorMessage(error.response?.data?.message || 'Could not fetch post HTML')
                    }
                } 
            }
        }
        fetchAndSetBlocks();
    }, [isEdit, post, setPostErrorMessage])

    //Introduces a text block upon first load
    useEffect(() => {
        if (!isEdit) {
            setBlocks([{
                data: { html: '' },
                id: v4(),
                isEditing: true,
                type: BLOCK_TYPES.TEXT
            }])
        }
    }, [isEdit])

    const generateCodeBlock = useCallback(async block => {
		if (!isAuthenticated) return;
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
            const response = await api.post('/generate_content', { 
                currentCode: block.data.code, 
                request: prompt, 
                senderId: user?.user_id,
            }, {
                timeout: 120000, //2 minute timeout
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
                setPostErrorMessage(response.data?.error || 'Creation error.');
                setTimeout(() => { setPostErrorMessage(''); }, 5000);
            }
        } catch (error) {
            updateBlock({ ...block, data: { ...block.data, isBlockLoading: false, _tempAiPrompt: '' } });
            let errorMessage = 'Error creating content.';
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please try again.';
            } else if (error.response?.status === 504) {
                errorMessage = 'Server timeout. Please try again.';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            setPostErrorMessage(errorMessage);
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
        }
    }, [hasMembership, limitReached, user, updateBlock, setPostErrorMessage]);

    const handleAddBlock = useCallback((type, data = {}) => {
        if (!isAuthenticated) return;
        setBlockLimitError('');
        if (blocks.length >= BLOCK_LIMIT) {
            setBlockLimitError(
                hasMembership
                    ? `Block limit (${BLOCK_LIMIT}) reached.`
                    : `Free block limit (${BLOCK_LIMIT}) reached. Get membership to add more:`
            );
            return;
        }
        const newBlock = {
            id: v4(),
            type,
            isEditing: type !== BLOCK_TYPES.MEDIA,
            data: (() => {
                switch (type) {
                    case BLOCK_TYPES.TEXT:
                        return { html: '' };
                    case BLOCK_TYPES.CODE:
                        return { code: '', isBlockLoading: false, showPrompt: true, ...data };
                    case BLOCK_TYPES.MEDIA:
                        return {
                            file: null,
                            fileType: '',
                            isImage: false,
                            isVideo: false,
                            url: '',
                            align: 'left',
                            ...data,
                        };
                    case BLOCK_TYPES.APP:
                        return { isUploading: true, ...data };
                    default:
                        return { ...data };
                }
            })(),
        };
        setBlocks(prev => {
            const isSingleEmptyText =
                prev.length === 1 &&
                prev[0].type === BLOCK_TYPES.TEXT &&
                (!prev[0].data.html || prev[0].data.html.trim() === '');
            //Only replace if the single empty block exists and the new one is not a text block
            return isSingleEmptyText && type !== BLOCK_TYPES.TEXT
                ? [newBlock]
                : [...prev, newBlock];
        });
    }, [blocks.length, BLOCK_LIMIT, hasMembership]);

    const handleFilesChange = useCallback((event, mediaType = null) => {
        if (!isAuthenticated) return;
        setBlockLimitError('');
        setPostErrorMessage('');
        const files = Array.from(event.target.files);
        const filteredFiles = mediaType
            ? files.filter(f => f.type.startsWith(mediaType === 'image' ? 'image/' : 'video/'))
            : files;
        const ALLOWED_MIME_TYPES = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/avif',
            'image/heic',
            'image/heif',
            'video/mp4',
            'video/quicktime',
            'video/webm',
            'video/x-matroska'
        ];
        const ALLOWED_EXTENSIONS = [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.avif',
            '.heic',
            '.heif',
            '.mp4',
            '.mov',
            '.webm',
            '.mkv'
        ];
        const invalidTypes = filteredFiles.filter(f => {
            const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
            return !ALLOWED_MIME_TYPES.includes(f.type) || !ALLOWED_EXTENSIONS.includes(ext);
        });
        if (invalidTypes.length) {
            setPostErrorMessage('File type not allowed');
            setTimeout(() => {
                setPostErrorMessage('');
            }, 5000);
            return;
        }
        if (blocks.length >= BLOCK_LIMIT) {
            setBlockLimitError(
                hasMembership
                    ? `Block limit (${BLOCK_LIMIT}) reached.`
                    : `Free block limit (${BLOCK_LIMIT}) reached. Get membership to add more:`
            );
            return;
        }
        const oversized = filteredFiles.filter(f => {
            const isVideo = f.type.startsWith('video/');
            const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
            return f.size > maxSize;
        });
        if (oversized.length) {
            const names = oversized.map(f => f.name).join(', ');
            setPostErrorMessage(
                hasMembership
                    ? `These files exceed your max size limit: ${names}.`
                    : `These files exceed your max size limit: ${names}. Get membership for more.`
            );
            setTimeout(() => {
                setPostErrorMessage('');
            }, 5000);
            return;
        }
        setPostErrorMessage('')
        const canFitCount = Math.max(0, BLOCK_LIMIT - blocks.length)
        const fittingFiles = hasMembership ? filteredFiles : filteredFiles.slice(0, canFitCount)
        const uniqueFiles = fittingFiles.map(file => {
            const ext = file.name.substring(file.name.lastIndexOf('.'))
            const uniqueName = `${Date.now()}-${v4()}${ext}`
            return new File([file], uniqueName, { type: file.type })
        })
        uniqueFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = function() {
                    handleAddBlock(BLOCK_TYPES.MEDIA, {
                        file,
                        fileType: file.type,
                        isImage: false,
                        isVideo: true,
                        url,
                        align: 'center',
                        duration: video.duration || null, //Duration in seconds
                    });
                };
                video.onerror = function() {
                    handleAddBlock(BLOCK_TYPES.MEDIA, {
                        file,
                        fileType: file.type,
                        isImage: false,
                        isVideo: true,
                        url,
                        align: 'center',
                        duration: null,
                    });
                };
                video.src = url;
            } else {
                handleAddBlock(BLOCK_TYPES.MEDIA, {
                    file,
                    fileType: file.type,
                    isImage: file.type.startsWith('image/'),
                    isVideo: false,
                    url,
                    align: 'center',
                });
            }
        });
    }, [MAX_FILE_SIZE, MAX_VIDEO_SIZE, BLOCK_LIMIT, blocks.length, hasMembership, isAuthenticated, handleAddBlock]);

    const onDragEnd = useCallback(result => {
        const { destination, source } = result
        if (!destination) return
        if (destination.index === source.index) return
        setBlocks(prev => reorder(prev, source.index, destination.index))
    }, [])

    const removeBlock = useCallback(async blockId => {
        const block = blocks.find(b => b.id === blockId)
        if (block?.type === BLOCK_TYPES.APP && block.data.buildId) {
            try {
                await api.delete('/remove_build', {
                    data: { buildId: block.data.buildId }
                })
            } catch {}
        }
        setBlocks(prev => prev.filter(b => b.id !== blockId))
        if (iframeRefs.current[blockId]) delete iframeRefs.current[blockId]
    }, [blocks])

    //Separate from submitForm since saving does not close the form
    const saveDraft = useCallback(async e => {
        if (!isAuthenticated) return;
        e.preventDefault();
        submittedRef.current = true;
        if (isContentEmpty(blocks)) {
            setPostErrorMessage(isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.');
            setTimeout(() => setPostErrorMessage(''), 5000);
            return;
        }
        const finalHTML = compileFinalHTML(blocks);
        const formData = new FormData();
        formData.append('content', finalHTML);
        if (!isReply) formData.append('title', title);
        if (isReply && post) formData.append('parent_id', post.post_id);
        blocks
            .filter(b => b.type === 'MEDIA' && b.data.file)
            .forEach(b => formData.append('files', b.data.file));
        formData.append('feed_id', feed?.feed_id);
        formData.append('channel_id', channelId);
        formData.append('poster_id', viewer?.feed_id);
        let id = draftId;
        if (!id) {
            id = v4();
            setDraftId(id);
        }
        formData.append('draft_id', id);
        try {
            const response = await api.post('/create_post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data?.success) {
                setPostErrorMessage('Draft saved');
                setTimeout(() => setPostErrorMessage(''), 3000);
                const savedDraft = response.data?.result;
                setDraftId(savedDraft?.draft_id || draftId || id);
            }
        } catch (error) {
            setPostErrorMessage(error.response?.data?.message || 'Error saving draft.');
            setTimeout(() => setPostErrorMessage(''), 5000);
        }
    }, [blocks, channelId, compileFinalHTML, draftId, feed?.feed_id, isContentEmpty, isReply, post, title, viewer?.feed_id]);

    const submitForm = useCallback(async e => {
        if (!isAuthenticated) return;
        e.preventDefault();
        submittedRef.current = true;
        if (blocks.length === 0 || isContentEmpty(blocks)) {
            setPostErrorMessage(isReply ? 'Reply cannot be empty.' : 'Post cannot be empty.');
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
            return;
        }
        try {
            const finalHTML = compileFinalHTML(blocks);
            const formData = new FormData();
            const postId = post?.post_id;
            const hasImages = blocks.some(b => b.type === BLOCK_TYPES.MEDIA && b.data.isImage);
            const hasVideos = blocks.some(b => b.type === BLOCK_TYPES.MEDIA && b.data.isVideo);
            const hasInteractive = blocks.some(b =>
                (b.type === BLOCK_TYPES.APP) || 
                (b.type === BLOCK_TYPES.CODE && 
                    !b.data.code?.includes('social-media-embed') &&
                    !b.data.code?.includes('embedded-website'))
            );
            const hasText = blocks.some(b => 
                b.type === BLOCK_TYPES.TEXT && b.data.html?.trim() !== ''
            );
            const imageCount = blocks.filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.isImage).length;
            const videoCount = blocks.filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.isVideo).length;
            const videoLength = blocks
                .filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.isVideo && b.data.duration)
                .reduce((sum, b) => sum + parseFloat(b.data.duration || 0), 0);
            formData.append('has_images', hasImages)
            formData.append('has_videos', hasVideos)
            formData.append('has_interactive', hasInteractive)
            formData.append('has_text', hasText)
            formData.append('image_count', imageCount)
            formData.append('video_count', videoCount)
            formData.append('video_length', videoLength)
            formData.append('content', finalHTML);
            formData.append('feed_id', feed?.feed_id);
            formData.append('is_private', feed?.type === 'public' ? false : true);
            //Publish draft as post if draftId exists
            if (draftId) {
                formData.append('draft_id', draftId);
                formData.append('publish_draft', 'true');
            }
            //Edit existing post if post_id exists
            if (!isReply && postId) formData.append('post_id', postId);
            if (!isReply) formData.append('title', title);
            if (channelId) formData.append('channel_id', channelId);
            if (isReply && post) formData.append('parent_id', post.post_id);
            blocks
                .filter(b => b.type === BLOCK_TYPES.MEDIA && b.data.file)
                .forEach(mediaBlock => formData.append('files', mediaBlock.data.file));
            setIsSubmitting(true);
            const response = await onPostSubmit(formData);
            setIsSubmitting(false);
            if (!response || response.success !== true) {
                setPostErrorMessage('Error submitting post. Please try again.');
                setTimeout(() => setPostErrorMessage(''), 5000);
                return;
            }
            setIsPostingDraft(false);
            setTitle('');
            setBlocks([]);
            setPostErrorMessage('');
        } catch (error) {
            setPostErrorMessage(error.response?.data?.message || 'Error submitting the form.');
            setTimeout(() => { setPostErrorMessage(''); }, 5000);
        }
    }, [blocks, channelId, compileFinalHTML, draftId, feed?.feed_id, isContentEmpty, isReply, onPostSubmit, post, title]);

    const toggleMediaAlignment = useCallback(block => {
        let newAlign;
        if (block.data.align === 'center') newAlign = 'left' 
        else if (block.data.align === 'left') newAlign = 'center' 
        else newAlign = 'center'
        updateBlock({ ...block, data: { ...block.data, align: newAlign } })
    }, [updateBlock])

    if (!isAuthenticated) {
        return null
    }
    return (
        <><div className="channel-feed" style={{ paddingTop: isReply ? '0px' : '20px' }}>
            {isReply && post && (
                <div className="post-reply-preview">
                    <ContentWidget canRemove={false} feed={feed} onPostRemoved={() => { } } post={previewPost} readOnly />
                </div>
            )}
            {!isReply && !isEdit && !post && (
                <p className="large-text">Create post in: {feed_name} / {channel_name}</p>
            )}
            <form id="post-form" className="post-form" onSubmit={submitForm}>
                <div className="post-header-buttons-sticky">
                    <div className="post-header-buttons">
                        <button className="small-icon" type="button" onClick={closeForm} title="Close">
                            ✕<p className="icon-text">Close</p>
                        </button>
                        <div className="dropdown" style={{ position: 'relative' }}>
                            <button className="small-icon" type="button" onClick={() => setAddContentDropdownOpen(!addContentDropdownOpen)} title="Add content">
                                <FaEllipsisV /><span className="icon-text">Add</span>
                            </button>
                            {addContentDropdownOpen && (
                                <div className="dropdown-menu" style={{ position: 'absolute', zIndex: 100, left: 0, top: '100%' }}>
                                    <button className="small-icon" type="button" onClick={() => { setAddContentDropdownOpen(false); handleAddBlock(BLOCK_TYPES.TEXT); } }>
                                        <FaFont /><span className="icon-text">Text</span>
                                    </button>
                                    <button className="small-icon" type="button" onClick={() => { setAddContentDropdownOpen(false); document.getElementById('image-input').click(); } }>
                                        <FaImage /><span className="icon-text">Image</span>
                                    </button>
                                    <button className="small-icon" type="button" onClick={() => { setAddContentDropdownOpen(false); document.getElementById('video-input').click(); } }>
                                        <FaVideo /><span className="icon-text">Video</span>
                                    </button>
                                    <button className="small-icon" type="button" onClick={() => { setAddContentDropdownOpen(false); handleAddBlock(BLOCK_TYPES.CODE); } }>
                                        <FaToolbox /><span className="icon-text">Custom</span>
                                    </button>
                                    {/*<button className="small-icon" type="button" onClick={() => { setAddContentDropdownOpen(false); document.getElementById('app-input').click(); }}>
                                        <FaCube /><span className="icon-text">App</span>
                                    </button>*/}
                                </div>
                            )}
                        </div>
                        <div className="right-buttons" style={{ display: 'flex', position: 'absolute', right: '0' }}>
                            {isEdit && (
                                <button className="small-icon" type="button" onClick={deleteClick} title={isDraft ? 'Delete draft' : 'Delete post'} disabled={isSubmitting}>
                                    <FaTrash /><p className="icon-text">Delete</p>
                                </button>
                            )}
                            {isReply ? (
                                <button className="small-icon" form="post-form" type="submit" title="Reply" disabled={isSubmitting}>
                                    {isSubmitting ? <FaCircleNotch className="spinner" /> : <><FaReply /><p className="icon-text">Reply</p></>}
                                </button>
                            ) : isEdit && !isDraft ? (
                                <button className="small-icon" form="post-form" type="submit" title="Save edit" disabled={isSubmitting}>
                                    {isSubmitting ? <FaCircleNotch className="spinner" /> : <><FaSave /><p className="icon-text">Save edit</p></>}
                                </button>
                            ) : (
                                <>
                                    <button className="small-icon" type="button" onClick={saveDraft} title="Save draft" disabled={isSubmitting}>
                                        <FaFileAlt /><p className="icon-text">Save draft</p>
                                    </button>
                                    <button className="small-icon" form="post-form" type="submit" title="Post" onClick={() => setIsPostingDraft(true)} disabled={isSubmitting}>
                                        {isSubmitting ? <FaCircleNotch className="spinner" /> : <><FaArrowRight /><p className="icon-text">Post</p></>}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ alignItems: 'center', alignSelf: 'center', display: 'flex', justifyContent: 'space-between', width: '97%' }}>
                    {!hasMembership ? (<Link className="small-icon" style={{ marginLeft: 0 }} to={`/settings/${user?.username}/membership`} type="button" title="View Membership">
                        <Crown />
                        <p className="icon-text">{blockLimitError ? blockLimitError : "Get membership"}</p>
                    </Link>) : (
                        <p className="error-message">{blockLimitError}</p>
                    )}
                    <p className="error-message">
                        {postErrorMessage}
                    </p>
                </div>
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
                                setPostErrorMessage('Title exceeds character limit.', !user?.has_membership && 'Get membership for more.');
                            }
                        } }
                        placeholder="Add title (optional)..."
                        type="text"
                        value={title} />
                )}
                <input accept="image/*" hidden id="image-input" multiple onChange={(e) => handleFilesChange(e, 'image')} type="file" />
                <input accept="video/*" hidden id="video-input" multiple onChange={(e) => handleFilesChange(e, 'video')} type="file" />
                <input accept=".zip" hidden id="app-input" onChange={appFileChange} type="file" />
                <div className='single-container'>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="blocks-droppable">
                            {provided => (
                                <div ref={provided.innerRef} {...provided.droppableProps}>
                                    {!blocks.length && <p className="small-text faded-text" style={{ marginLeft: '10px' }}>Add content using the 'Add' button</p>}
                                    {blocks.map((block, index) => {
                                        const { data, id, isEditing, type } = block;
                                        const toggleEdit = () => updateBlock({ ...block, isEditing: !isEditing });
                                        return (
                                            <Draggable key={id} draggableId={id} index={index} isDragDisabled={cropState[id]?.isCropping}>
                                                {provided2 => (
                                                    <div
                                                        className="block-drag-container"
                                                        ref={provided2.innerRef}
                                                        {...provided2.draggableProps}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            ...provided2.draggableProps.style
                                                        }}
                                                    >
                                                        <div
                                                            className="faded-text"
                                                            {...provided2.dragHandleProps}
                                                            style={{
                                                                cursor: 'grab',
                                                                display: 'flex',
                                                                marginLeft: '4px',
                                                                marginRight: '4px',
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <FaGripVertical size={20} />
                                                        </div>
                                                        <div className="block" style={{ flex: 1 }}>
                                                            {type !== BLOCK_TYPES.TEXT && (
                                                                <div className="block-controls" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    {type === BLOCK_TYPES.CODE && (
                                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                                            {isEditing && (
                                                                                <button className="small-icon" onClick={() => updateBlock({ ...block, data: { ...data, showPrompt: !data.showPrompt } })} title={data.showPrompt ? 'Direct input' : 'Prompt'} type="button">
                                                                                    {data.showPrompt ? <FaTerminal /> : <FaCommentAlt />}
                                                                                </button>
                                                                            )}
                                                                            <button className="small-icon" onClick={toggleEdit} title={isEditing ? 'Preview' : 'Edit'} type="button">{isEditing ? <FaEye /> : <FaEdit />}</button>
                                                                            <button
                                                                                className="small-icon"
                                                                                onClick={() => {
                                                                                    async function doCopy() {
                                                                                        await navigator.clipboard.writeText(data.code);
                                                                                    }
                                                                                    doCopy().then(() => {
                                                                                        setPostErrorMessage('Copied');
                                                                                        setTimeout(() => setPostErrorMessage(''), 2000);
                                                                                    });
                                                                                }}
                                                                                title="Copy"
                                                                                type="button"
                                                                            >
                                                                                <FaCopy />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {type === BLOCK_TYPES.MEDIA && (
                                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                                            {data.isImage && (
                                                                                <button
                                                                                    className="small-icon"
                                                                                    onClick={() => setCropState(prev => ({
                                                                                        ...prev,
                                                                                        [id]: {
                                                                                            isCropping: true,
                                                                                            crop: undefined
                                                                                        }
                                                                                    }))}
                                                                                    title="Crop image"
                                                                                    type="button"
                                                                                >
                                                                                    <FaCrop /><p className="icon-text">Crop</p>
                                                                                </button>
                                                                            )}
                                                                            <button className="small-icon" onClick={() => toggleMediaAlignment(block)} title={block.data.align === 'center' ? "Align left" : "Align centre"} type="button">
                                                                                <FaAlignCenter /><p className="icon-text">Align</p>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                                                                        {(type === BLOCK_TYPES.MEDIA || type === BLOCK_TYPES.CODE) && (
                                                                            <button className="small-icon" onClick={() => removeBlock(id)} title="Delete" type="button"><FaTrash /></button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {type === BLOCK_TYPES.TEXT && (
                                                                <div className="block-content">
                                                                    {data.textError && (
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '5px' }}>
                                                                            {data.textError}
                                                                            <button className="small-icon" onClick={() => navigate('/settings/membership')} type="button" style={{ marginLeft: '5px' }}><FaArrowCircleUp /></button>
                                                                        </div>
                                                                    )}
                                                                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                                        <ReactQuill
                                                                            className="text-editor"
                                                                            onChange={val => {
                                                                                const plainText = val.replace(/<[^>]*>/g, '');
                                                                                //Auto-underline links and normalize URLs
                                                                                const processedVal = val.replace(/<a href="([^"]*)"([^>]*)>/g, (match, url, rest) => {
                                                                                    let normalizedUrl = url.trim();
                                                                                    //Add https:// if no protocol exists
                                                                                    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                                                                                        normalizedUrl = 'https://' + normalizedUrl;
                                                                                    }
                                                                                    //Add www. if not present and not a subdomain
                                                                                    try {
                                                                                        const parsed = new URL(normalizedUrl);
                                                                                        const hostParts = parsed.hostname.split('.');
                                                                                        if (hostParts.length === 2) {
                                                                                            parsed.hostname = 'www.' + parsed.hostname;
                                                                                            normalizedUrl = parsed.href;
                                                                                        }
                                                                                    } catch (e) {
                                                                                        //Keep original if URL parsing fails
                                                                                    }
                                                                                    return `<a href="${normalizedUrl}" style="text-decoration: underline;"${rest}>`;
                                                                                });
                                                                                //Prevent infinite loop by checking if value actually changed
                                                                                if (processedVal === data.html) return;
                                                                                if (plainText.length < TEXT_CHAR_LIMIT) {
                                                                                    updateBlock({ ...block, data: { ...data, html: processedVal, textError: '' } });
                                                                                } else {
                                                                                    updateBlock({ ...block, data: { ...data, textError: `Exceeded ${TEXT_CHAR_LIMIT} character limit. ${!user?.has_membership && 'Get membership for more.'}` } });
                                                                                }
                                                                            }}
                                                                            placeholder="Begin writing..."
                                                                            theme="snow"
                                                                            value={data.html}
                                                                            style={{ flex: 1 }}
                                                                            modules={{
                                                                                toolbar: [
                                                                                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                                                                                    ['bold', 'italic', 'underline', 'strike'],
                                                                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                                                    [{ 'color': [] }],
                                                                                    ['link']
                                                                                ]
                                                                            }}
                                                                        />
                                                                        <button className="small-icon" onClick={() => removeBlock(id)} title="Delete" type="button">
                                                                            <FaTrash />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {type === BLOCK_TYPES.CODE && (
                                                                <div className="block-content">
                                                                    {!data.showPrompt && isEditing && (
                                                                        <p className="small-text faded-text">For now, only one HTML file with inline JavaScript and CSS can be created.</p>
                                                                    )}
                                                                    {isEditing && (
                                                                        <>
                                                                            {data.showPrompt ? (
                                                                                <div className="ai-generator">
                                                                                    <textarea className="ai-prompt"
                                                                                        disabled={limitReached || data.isBlockLoading}
                                                                                        onChange={(e) => {
                                                                                            const input = e.target.value;
                                                                                            if (input.length <= TEXT_CHAR_LIMIT) {
                                                                                                updateBlock({ ...block, data: { ...data, _tempAiPrompt: input } });
                                                                                                setPostErrorMessage('');
                                                                                            } else {
                                                                                                updateBlock({ ...block, data: { ...data, _tempAiPrompt: input } });
                                                                                                setPostErrorMessage('Too long.', !user?.has_membership && 'Get membership for more.');
                                                                                            }
                                                                                        }}
                                                                                        placeholder={limitReached ? (user?.has_membership ? "Limit reached. Buy new membership to reset"
                                                                                            : "Limit reached. Get membership for more.")
                                                                                            : data.isBlockLoading ? "Creating post... may take up to a minute"
                                                                                                : "Describe your custom post..."}
                                                                                        value={data.isBlockLoading ? '' : (data._tempAiPrompt || '')} />
                                                                                    <button className={data.isBlockLoading || !data._tempAiPrompt?.trim() || limitReached ? 'small-icon disabled' : 'small-icon'}
                                                                                        disabled={data.isBlockLoading || !data._tempAiPrompt?.trim() || limitReached}
                                                                                        onClick={() => generateCodeBlock(block)}
                                                                                        title={limitReached ? (user?.has_membership ? "Usage limit reached"
                                                                                            : "Limit reached. Get membership for more.")
                                                                                            : data.isBlockLoading ? 'Creating...'
                                                                                                : !data._tempAiPrompt?.trim() ? 'Enter a prompt'
                                                                                                    : 'Create'}
                                                                                        type="button">
                                                                                        {data.isBlockLoading ? <FaCircleNotch className="spinner" /> : <FaArrowCircleUp />}
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <textarea
                                                                                    className="code-input"
                                                                                    onChange={e => {
                                                                                        const newValue = e.target.value;
                                                                                        if (newValue.length <= 100 * TEXT_CHAR_LIMIT) {
                                                                                            updateBlock({
                                                                                                id: block.id,
                                                                                                data: {
                                                                                                    ...data,
                                                                                                    code: newValue
                                                                                                }
                                                                                            });
                                                                                            setPostErrorMessage('');
                                                                                        } else {
                                                                                            setPostErrorMessage('Code exceeds character limit.', !user?.has_membership && 'Get membership for more.');
                                                                                        }
                                                                                    }}
                                                                                    placeholder="Enter code..."
                                                                                    value={data.code} />
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {data.code.trim() ? (
                                                                        <div className="code-preview">
                                                                            <iframe ref={el => { iframeRefs.current[id] = el; }} sandbox="allow-scripts allow-same-origin" srcDoc={data.code} style={{ border: 'none', width: '100%', height: '50vh' }} title={`code-preview-${id}`} />
                                                                        </div>
                                                                    ) : (
                                                                        <p className="small-text faded-text">Nothing to preview</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {type === BLOCK_TYPES.MEDIA && (
                                                                <div className="media-preview">
                                                                    {cropState[id]?.isCropping && data.isImage ? (
                                                                        <div>
                                                                            <div className="crop-container" style={data.align === 'center' ? { display: 'flex', justifyContent: 'center' } : {}}>
                                                                                <ReactCrop
                                                                                    crop={cropState[id]?.crop}
                                                                                    onChange={(pixelCrop) => setCropState(prev => ({
                                                                                        ...prev,
                                                                                        [id]: {
                                                                                            ...prev[id],
                                                                                            crop: pixelCrop
                                                                                        }
                                                                                    }))}
                                                                                >
                                                                                    <img
                                                                                        ref={(el) => { if (el) cropImageRefs.current[id] = el; }}
                                                                                        alt="Crop preview"
                                                                                        src={data.url}
                                                                                        style={{ maxWidth: '100%', maxHeight: '60vh' }}
                                                                                    />
                                                                                </ReactCrop>
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
                                                                                <img alt="Uploaded Media" src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: '60vh' } : { maxWidth: '100%', maxHeight: '60vh' }} />
                                                                            ) : data.isVideo ? (
                                                                                <video controls src={data.url} style={data.align === 'center' ? { display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: '60vh' } : { maxWidth: '100%', maxHeight: '60vh' }} />
                                                                            ) : (
                                                                                <p>Unsupported</p>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {type === BLOCK_TYPES.APP && (
                                                                data.isUploading
                                                                    ? <div key={id} className="app-placeholder">
                                                                        <p>{data.fileName}</p>
                                                                        <FaCircleNotch className="spinner" />
                                                                    </div>
                                                                    : data.buildId
                                                                        ? <iframe
                                                                            ref={el => { iframeRefs.current[id] = el; }}
                                                                            sandbox="allow-scripts allow-same-origin"
                                                                            src={`/app_builds/${data.buildId}/index.html`}
                                                                            style={{ border: 'none', width: '100%', height: '50vh' }}
                                                                            title={`app-preview-${id}`} />
                                                                        : null
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
            </form>
        </div>
        <ConfirmModal isOpen={showDeleteConfirm} onConfirm={confirmDelete} onCancel={cancelDelete} title={`Delete ${pendingDeleteAction}`} message={`Are you sure you want to delete this ${pendingDeleteAction}?`} />
        </>
    )
}

export default ContentForm;