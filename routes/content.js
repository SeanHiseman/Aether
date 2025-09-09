import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import deleteMedia from '../functions/media_handling/deleteMedia.js';
import cheerio from 'cheerio';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AppBuilds, Feeds, FeedChannels, Posts, PostDrafts, PostNotes, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import sequelize from '../databaseSetup.js';
import { Op, Sequelize } from 'sequelize';
import unzipper from 'unzipper'
import { v4 } from 'uuid';
import yauzl from 'yauzl'

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildsDir = path.join(process.cwd(), process.env.APP_BUILD_DIR);
const mediaDir = path.join(__dirname, '..', 'media', 'content');
const contentAnalyser = new ContentAnalyser();
const router = Router();
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
const calculateFileSizes = files => files.reduce((total, file) => total + file.size, 0) / (1024 * 1024);

const checkStorageLimit = async (req, res, next) => {
    try {
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ 
                success: false, 
                message: `Weekly limit of ${maxStorage}MB exceeded` 
            });
        }
        req.currentUser = user;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

router.get('/channel_posts', async (req, res) => {
	try {
		const { channelId, excludedPostIds, feedId, isGroup, isMain, isSingle, postId } = req.query;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = parseInt(req.query.offset, 10) || 0;
		const viewerId = req.session.viewer_id;
		const includeOptions = [{
			as: 'note',
			model: PostNotes,
			required: false
		},{
			as: 'parentChannel',
			attributes: ['channel_id', 'channel_name', 'feed_id'],
			include: [{
				model: Feeds
			}],
			model: FeedChannels,
			required: false
		},{
			as: 'poster',
			model: Feeds
		},{
			as: 'votes',
			attributes: ['downvotes', 'upvotes'],
			model: PostVotes,
			required: false
		}];
		if (isSingle === 'true') {
			const singlePost = await Posts.findOne({
				include: includeOptions,
				where: {
					...(channelId ? { channel_id: channelId } : {}),
					feed_id: feedId,
					post_id: postId
				}
			});
			if (!singlePost) return res.status(404).json({ success: false });
			const existing = viewerId
				? await SavedPosts.findOne({
						where: { post_id: postId, saver_id: viewerId }
				  })
				: null;
			singlePost.dataValues.is_saved = Boolean(existing);
			return res.status(200).json({ success: true, post: singlePost });
		}
		const results = await ApplyAlgorithm({ 
            locationId: channelId,
            excludedPostIds, 
            feedId, 
            includeOptions, 
            isGroup, 
            isMain, 
            limit, 
            offset, 
            viewerId,
        });
		if (!results.length) return res.status(200).json([]);
		return res.status(200).json(results);
	} catch (error) {
		return res.status(500).json({ success: false, message: 'Error getting posts.' });
	}
});

router.post('/content_vote', authenticateCheck, async (req, res) => {
    try {
        const { postId, feedId, voteType } = req.body; //feedId refers to the user who is voting
        const voteLimit = 1; //Changed from 10
        const content = await Posts.findByPk(postId);
        if (!content) {
            return res.status(404).json({ success: false, message: 'Content not found' });
        }
		const [vote, created] = await PostVotes.findOrCreate({
			where: { post_id: postId, voter_id: feedId },
			defaults: {
				vote_id: v4(),
				upvotes: 0,
				downvotes: 0,
			}
		});
		const currentNetVote = vote.upvotes - vote.downvotes;
		if (voteType === 'check_vote') {
			return res.status(200).json({
				success: true,
				message: 'vote status',
				reachedUpvoteLimit: currentNetVote >= voteLimit,
				reachedDownvoteLimit: currentNetVote <= -voteLimit,
				currentUpvotes: vote.upvotes,
				currentDownvotes: vote.downvotes,
				netVote: currentNetVote
			});
		}
		if (voteType === 'upvote') {
			if (currentNetVote < voteLimit) {
				if (vote.downvotes > 0) {
					vote.downvotes -= 1;
					content.downvotes -= 1;
				} else {
					vote.upvotes += 1;
					content.upvotes += 1;
				}
			} else {
				return res.status(200).json({
					success: false,
					message: 'upvote limit',
					reachedUpvoteLimit: true,
					reachedDownvoteLimit: currentNetVote <= -voteLimit
				});
			}
		} else if (voteType === 'downvote') {
			if (currentNetVote > -voteLimit) {
				if (vote.upvotes > 0) {
					vote.upvotes -= 1;
					content.upvotes -= 1;
				} else {
					vote.downvotes += 1;
					content.downvotes += 1;
				}
			} else {
				return res.status(200).json({
					success: false,
					message: 'downvote limit',
					reachedUpvoteLimit: currentNetVote >= voteLimit,
					reachedDownvoteLimit: true
				});
			}
		}
		await vote.save();
		await content.save();
		const newNetVote = vote.upvotes - vote.downvotes;
		return res.status(200).json({
			success: true,
			upvotes: content.upvotes,
			downvotes: content.downvotes,
			netVote: newNetVote,
			reachedUpvoteLimit: newNetVote >= voteLimit,
			reachedDownvoteLimit: newNetVote <= -voteLimit
		});
	} catch (error) {
		return res.status(500).json({ success: false });
	}
});

const postFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (!mimetype || !extname) {
        return cb(new Error('Only images and videos are allowed'));
    }
    const maxSize = (req.session?.user?.has_membership ? 100 : 1) * 1024 * 1024;
    if (file.size > maxSize) {
        return cb(new Error(`File exceeds the limit of ${maxSize / (1024 * 1024)}MB`));
    }
    cb(null, true);
};

const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaDir);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = `${v4()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, uniqueFilename);
    }
});

const postUpload = multer({
    fileFilter: postFilter,
    storage: postStorage
});

router.post('/create_draft', authenticateCheck, checkStorageLimit, postUpload.array('files'), async (req, res) => {
    try {
        let { draft_id, feed_id, channel_id, parent_id, content, title, poster_id } = req.body
        if (!draft_id) draft_id = v4()
        const $ = cheerio.load(content, { decodeEntities:false })
        let fileIdx = 0
        $('img[src^="blob:"], video[src^="blob:"]').each((i, el) => {
            const file = req.files[fileIdx++]
            if (!file) return
            const src = `/media/content/${file.filename}`
            if (el.tagName==='img') {
                $(el).attr('src', src)
                .removeAttr('blob:')
            } else {
                $(el).empty()
                .append(`<source src="${src}" type="${file.mimetype}">`)
            }
        })
        const modifiedContent = $.html()
        const draft = await PostDrafts.upsert({
            draft_id, feed_id, channel_id,
            parent_id: parent_id||null,
            content: modifiedContent,
            title: title||null,
            poster_id
        });
        return res.status(200).json({ success: true, draft: draft })
    } catch(error) {
        if (req.files) {
            req.files.forEach(f => {
                fs.unlinkSync(path.join(__dirname,'../media/content',f.filename))
            })
        }
        return res.status(500).json({ success: false, error: error.message })
    }
});

router.post('/create_post', authenticateCheck, checkStorageLimit, postUpload.array('files'), async (req, res) => {
    try {
        let { channel_id, content, feed_id, parent_id, post_id, poster_id, title } = req.body;
        if (!post_id) {
            post_id = v4();
        }
        content = content || '';
        const $ = cheerio.load(content, { decodeEntities: false });
        if (req.files && req.files.length > 0) {
            const totalFileSize = calculateFileSizes(req.files);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 100 * 1024 : 100;
            if (user.storage_count + totalFileSize > maxStorage) {
                req.files.forEach(file => {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                });
                return res.status(413).json({ 
                    success: false, 
                    message: `Weekly limit of ${maxStorage}MB exceeded` 
                });
            }
            user.storage_count += totalFileSize;
            await user.save();
            let index = 0;
            $('img[src^="blob:"], video[src^="blob:"]').each((i, el) => {
                if (index < req.files.length) {
                    const file = req.files[index];
                    const fileType = file.mimetype.startsWith('image/') ? 'img' : 'video';
                    if (fileType === 'img') {
                        $(el).attr('src', `/media/content/${file.filename}`);
                        $(el).removeAttr('blob:');
                        $(el).attr('alt', 'Uploaded Image');
                    } else {
                        $(el).empty();
                        $(el).append(`<source src="/media/content/${file.filename}" type="${file.mimetype}">`);
                    }
                    index++;
                }
            });
        }
        const modifiedContent = $.html();
        const analysisResults = await contentAnalyser.analyseContent(modifiedContent, title);
        const postData = {
            channel_id, 
            content: modifiedContent, 
            feed_id, 
            parent_id, 
            post_id, 
            poster_id, 
            title,
            ...analysisResults 
        };
        const post = await Posts.create(postData);
        if (parent_id) {
            const parentPost = await Posts.findOne({ where: { post_id: parent_id } });
            if (parentPost) {
                parentPost.replies += 1;
                await parentPost.save();
            }
        }
        return res.status(200).json({ success: true, post });
    } catch (error) {
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                } catch (cleanupError) {
                    return res.status(500).json({ success: false, error: cleanupError });
                }
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/edit_post', authenticateCheck, checkStorageLimit, postUpload.array('files'), async (req, res) => {
    try {
        let { content, post_id, title } = req.body;
        const foundPost = await Posts.findByPk(post_id);
        if (!foundPost) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }
        const $ = cheerio.load(content, { decodeEntities: false });
        if (req.files && req.files.length > 0) {
            const totalFileSize = calculateFileSizes(req.files);
            const user = req.currentUser;
            const maxStorage = user.has_membership ? 100 * 1024 : 100; //100GB for members, 100MB for non-members
            if (user.storage_count + totalFileSize > maxStorage) {
                req.files.forEach(file => {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                });
                return res.status(413).json({ 
                    success: false, 
                    message: `Weekly limit of ${maxStorage}MB exceeded` 
                });
            }
            user.storage_count += totalFileSize;
            await user.save();
            let index = 0;
            $('img[src^="blob:"], video[src^="blob:"]').each((i, el) => {
                if (index < req.files.length) {
                    const file = req.files[index];
                    const fileType = file.mimetype.startsWith('image/') ? 'img' : 'video';
                    if (fileType === 'img') {
                        $(el).attr('src', `/media/content/${file.filename}`);
                        $(el).removeAttr('blob:');
                        $(el).attr('alt', 'Uploaded Image');
                    } else {
                        $(el).empty();
                        $(el).append(`<source src="/media/content/${file.filename}" type="${file.mimetype}">`);
                    }
                    index++;
                }
            });
        }
        foundPost.content = $.html();
        if (title) {
            foundPost.title = title;
        }
        foundPost.updated_at = Sequelize.literal('CURRENT_TIMESTAMP(3)');
        await foundPost.save();
        return res.status(201).json({ success: true });
    } catch (error) {
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(mediaDir, file.filename));
                } catch (err) {
                    res.status(500).json({ success: false, error: err.message });
                }
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.get("/explore_posts", async (req, res) => {
    try {
        const { exclude = [] } = req.query;
        const excludeArray = Array.isArray(exclude) ? exclude : exclude.split(',').filter(Boolean);
        const viewerId = req.session.viewer_id;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = parseInt(req.query.offset, 10) || 0;
        const includeOptions = [{
            model: Feeds,
            as: "poster",
        },{
            model: FeedChannels,
            as: "parentChannel",
            attributes: ["channel_id", "channel_name"],
            include: [{
                model: Feeds,
                required: true,
                where: {
                    type: {
                        [Op.ne]: "private"
                    }
                }
            }],
            required: true
        },{
            model: PostNotes,
            as: "note",
            required: false,
        },{
            model: PostVotes,
            as: "votes",
            attributes: ["upvotes", "downvotes"],
            required: false,
        }];
        const posts = await ApplyAlgorithm({
            locationId: 'explore',
            excludedPostIds: excludeArray,
            feedId: null,
            includeOptions: includeOptions,
            isMain: 'false',
            limit: limit,
            offset: offset,
            viewerId,
        });
        res.status(200).json({ posts: posts, hasMore: posts.length === limit });
    } catch (error) {
        console.error("Error in /explore_posts:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/get_post_drafts', authenticateCheck, async (req, res) => {
    try {
        const { channel_id, poster_id, limit = 10, offset = 0 } = req.query;
        const drafts = await PostDrafts.findAll({
            where: { channel_id, poster_id },
            order: [['updated_at','DESC']],
            limit: parseInt(limit,  10),
            offset: parseInt(offset, 10)
        });
        return res.status(200).json({ drafts });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to load drafts' });
    }
});

const deleteBuilds = async html => {
	const buildsDir	= path.resolve(process.cwd(), 'app_builds');
	const ids = new Set();
	const regexAttr	= /data-buildid="([0-9a-fA-F-]{36})"/g;
	const regexPath	= /\/app_builds\/([0-9a-fA-F-]{36})/g;
	let match;
	while ((match = regexPath.exec(html)) !== null)	ids.add(match[1].toLowerCase());
	while ((match = regexAttr.exec(html)) !== null)	ids.add(match[1].toLowerCase());
	for (const id of ids) {
		const dir = path.join(buildsDir, id);
		try { await fs.promises.rm(dir, { recursive: true, force: true }); } catch {}
		await AppBuilds.destroy({ where: { build_id: id } });
	}
};

router.delete('/remove_build', authenticateCheck, async (req, res) => {
		const { buildId } = req.body;
		if (!buildId) {
			return res.status(400).json({ success: false, message: 'Missing buildId' });
		}
		try {
			await deleteBuilds(`<div data-buildid="${buildId}"></div>`);
			return res.status(200).json({ success: true });
		} catch (error) {
			return res.status(500).json({ success: false });
		}
	}
);

router.delete('/remove_draft', authenticateCheck, async (req, res) => {
    let transaction;
	try {
        transaction = await sequelize.transaction();
		const { draft, isPosting } = req.body;
		const foundDraft = await PostDrafts.findByPk(draft.draft_id);
		if (foundDraft) {
			deleteMedia(foundDraft.content);
			if (!isPosting) await deleteBuilds(foundDraft.content, { transaction }); //Prevents build removal when posting drafts
			await PostDrafts.destroy({ where: { draft_id: draft.draft_id } });
		}
        await transaction.commit();
		return res.status(200).json({ success: true });
	} catch (error) {
        if (transaction) await transaction.rollback();
		return res.status(500).json({ success: false });
	}
});

router.delete('/remove_post', authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { post } = req.body;
		const foundPost = await Posts.findByPk(post.post_id);
		if (foundPost) {
			deleteMedia(foundPost.content);
			await deleteBuilds(foundPost.content, { transaction });
			if (post.parent_id) {
				const parentPost = await Posts.findByPk(post.parent_id);
				parentPost.replies -= 1;
				await parentPost.save();
			}
			await PostVotes.destroy({ where: { post_id: post.post_id }, transaction });
			await PostNotes.destroy({ where: { post_id: post.post_id }, transaction });
			await Posts.destroy({ where: { post_id: post.post_id }, transaction });
		}
		await transaction.commit();
		return res.status(200).json({ success: true });
	} catch (error) {
		if (transaction) await transaction.rollback();
		return res.status(500).json({ success: false });
	}
});

router.post('/increment_views', authenticateCheck, async (req, res) => {
	let transaction;
    try {
		transaction = await sequelize.transaction();
        const { postId } = req.body;
        const post = await Posts.findByPk(postId, { transaction });
		post.views += 1;
        await post.save({ transaction});
		const existingView = await ViewedPosts.findOne({
			where: { post_id: postId, viewer_id: req.session.viewer_id }.
			transaction,
		});
		if (existingView) {
			existingView.views += 1;
			await existingView.save({ transaction});
		} else {
			await ViewedPosts.create({
				post_id: postId,
				viewer_id: req.session.viewer_id,	
				views: 1
			}, { transaction });
		}
		await transaction.commit();
        res.status(200).json({ success: true });
    } catch (error) {
		if (transaction) await transaction.rollback();
        res.status(500).json({ success: false });   
    }
});

router.get('/post_replies/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const parentPost = await Posts.findOne({ where: { post_id: postId } });
        if (!parentPost) {
            return res.status(404).json({ success: false, message: 'Parent post not found.' });
        }
        const includeOptions = [{
                model: Feeds,
                as: 'poster',
            },{
                model: PostVotes,
                as: 'votes',
                attributes: ['upvotes', 'downvotes'],
                required: false
            },{
                model: PostNotes,
                as: 'note',
                required: false
            },{
                model: FeedChannels,
                as: 'parentChannel',
                attributes: ['channel_name', 'channel_id'],
                required: false,
                include: [{
                    model: Feeds,
                }]
            }
        ];
        const parentFeedId = parentPost.feed_id;
        const parentChannelId = parentPost.channel_id;
        const whereClause = {
            parent_id: postId,
            ...(parentFeedId ? { feed_id: parentFeedId } : {}),
            ...(parentChannelId ? { channel_id: parentChannelId} : {})
        };
        const replies = await Posts.findAll({
            where: whereClause,
            include: includeOptions,
            order: [['created_at', 'DESC']],
        });
        const formattedReplies = replies.map(reply => ({
            ...reply.dataValues,
        }));
        return res.status(200).json(formattedReplies);
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

//Protect against zip bombs
const MAX_ENTRIES = 100000
const MAX_TOTAL_UNCOMPRESSED = 500 * 1024 * 1024 

const isValidZip = filePath => new Promise((resolve, reject) => {
	yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
		if (err) return reject(err)
		let entriesCount = 0
		let totalUncompressed = 0
		zipfile.readEntry()
		zipfile.on('entry', entry => {
			entriesCount++
			totalUncompressed += entry.uncompressedSize
			if (entriesCount > MAX_ENTRIES || totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
				zipfile.close()
				return reject(new Error('Archive exceeds allowed limits'))
			}
			zipfile.readEntry()
		})
		zipfile.on('end', () => resolve(true))
	})
})

const buildFilter = (req, file, cb) =>
	file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')
		? cb(null, true)
		: cb(new Error('Only .zip builds are allowed'))

const buildStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, buildsDir),
	filename: (req, file, cb) => cb(null, `${v4()}.zip`)
})

const upload = multer({ fileFilter: buildFilter, storage: buildStorage })

const locateIndexDir = async start => {
	const queue = [start]
	while (queue.length) {
		const current = queue.shift()
		const entries = await fs.promises.readdir(current, { withFileTypes: true })
		if (entries.some(e => e.isFile() && e.name === 'index.html')) return current
		for (const e of entries.filter(e => e.isDirectory()))
			queue.push(path.join(current, e.name))
	}
	return null
}

router.post('/upload_build', authenticateCheck, upload.single('build'), async (req, res) => {
	let baseUrl
	let buildId
	let indexDir
	let kind
	let targetDir
	let tmpZip
	try {
		if (!req.file) throw new Error('No file uploaded')
		buildId = v4()
		tmpZip = req.file.path
		await isValidZip(tmpZip)
		targetDir = path.join(buildsDir, buildId)
		await fs.promises.mkdir(targetDir, { recursive: true })
		await fs.createReadStream(tmpZip).pipe(unzipper.Extract({ path: targetDir })).promise()
		await fs.promises.unlink(tmpZip)					
		indexDir = await locateIndexDir(targetDir)
		kind = fs.existsSync(path.join(targetDir, 'package.json')) ? 'webcontainer' : 'static'
		const relDir = path.relative(targetDir, indexDir).replace(/\\/g, '/')
		baseUrl = `/app_builds/${buildId}${relDir ? `/${relDir}` : ''}`
		if (kind === 'static') {
			const htmlPath = path.join(indexDir, 'index.html')
			const html = await fs.promises.readFile(htmlPath, 'utf8')
			const patched = html
				.replace(/(href|src)="\/([^"]+)"/g, `$1="${baseUrl}/$2"`)
				.replace(/<head>/, `<head><base href="${baseUrl}/">`)
			await fs.promises.writeFile(htmlPath, patched)
		}
		await AppBuilds.create({ build_id: buildId, kind, path: baseUrl })
		return res.status(201).json({ buildId, kind, path: baseUrl, success: true })
	} catch (error) {
		if (tmpZip) {
			try { await fs.promises.unlink(tmpZip) } catch {}
		}
		if (targetDir) {
			try { await fs.promises.rm(targetDir, { recursive: true, force: true }) } catch {}
		}
		return res.status(400).json({ message: error.message, success: false })
	}
})

export default router;