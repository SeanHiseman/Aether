import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import DeleteMedia from '../functions/media_handling/deleteMedia.js';
import cheerio from 'cheerio';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AppBuilds, Feeds, FeedChannels, Posts, PostDrafts, PostNotes, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import { GenerateFileName } from '../functions/media_handling/generateFileName.js';
import multer from 'multer';
import { Router } from 'express';
import path from 'path';
import sequelize from '../databaseSetup.js';
import { standardLimiter, higherLimiter } from '../functions/checks/limiters.js';
import { Op, Sequelize } from 'sequelize';
import unzipper from 'unzipper';
import UpdateMediaFiles from '../functions/media_handling/updateMediaFiles.js';
import { DeleteFromS3, UploadToS3 } from '../functions/media_handling/s3Handling.js';
import { v4 } from 'uuid';
import yauzl from 'yauzl';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildsDir = path.join(process.cwd(), process.env.APP_BUILD_DIR);
const mediaDir = path.join(__dirname, '..', 'media', 'content');
const postsDir = path.join(__dirname, '..', 'media', 'posts');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
const contentAnalyser = new ContentAnalyser();
const router = Router();
//const calculateFileSizes = files => files.reduce((total, file) => total + file.size, 0) / (1024 * 1024);

const checkStorageLimit = async (req, res, next) => {
    try {
        const user = await Users.findByPk(req.session.user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const maxStorage = user.has_membership ? 25 * 1024 : 100; //25GB for members, 100MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ 
                success: false, 
                message: `Weekly limit of ${maxStorage}MB exceeded` 
            });
        }
        req.currentUser = user;
        next();
    } catch (error) {
		console.error("Error checking storage limit:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

router.post('/channel_posts', standardLimiter, async (req, res) => {
	try {
		const { channelId, excludedPostIds, feedId, isGroup, isMain, isSingle, postId, limit = 50, offset = 0, recentUpvotes } = req.body;
		console.log("channel posts req.body:", req.body);
		const viewerId = req.session.viewer_id;
		const includeOptions = [{
			as: 'note',
			model: PostNotes,
			required: false
		},{
			as: 'parentChannel',
			attributes: ['channel_id', 'channel_name', 'feed_id'],
			include: [{ model: Feeds }],
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
		if (isSingle === true) { 
			const singlePost = await Posts.findOne({
				include: includeOptions,
				where: {
					...(channelId ? { channel_id: channelId } : {}),
					feed_id: feedId,
					post_id: postId
				}
			});
			if (!singlePost) {
				console.log("post not found");
				return res.status(404).json({ success: false, message: 'Post not found' });} else {
			const existing = viewerId
				? await SavedPosts.findOne({ where: { post_id: postId, saver_id: viewerId } })
				: null;
			singlePost.dataValues.is_saved = Boolean(existing);
			return res.status(200).json({ success: true, post: singlePost });}
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
			recentUpvotes,
            viewerId,
        });
		return res.status(200).json({ success: true, posts: results });
	} catch (error) {
        console.error("Error in /channel_posts:", error);
		return res.status(500).json({ success: false, message: 'Error getting posts.' });
	}
});

router.post('/content_vote', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { postId, feedId, voteType } = req.body;
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
        if (voteType === 'upvote') {
            if (vote.upvotes > 0) {
                vote.upvotes = 0;
                content.upvotes -= 1;
            } else {
                if (vote.downvotes > 0) {
                    vote.downvotes = 0;
                    content.downvotes -= 1;
                }
                vote.upvotes = 1;
                content.upvotes += 1;
            }
        } else if (voteType === 'downvote') {
            if (vote.downvotes > 0) {
                vote.downvotes = 0;
                content.downvotes -= 1;
            } else {
                if (vote.upvotes > 0) {
                    vote.upvotes = 0;
                    content.upvotes -= 1;
                }
                vote.downvotes = 1;
                content.downvotes += 1;
            }
        }
        await vote.save();
        await content.save();
        return res.status(200).json({
            success: true,
            upvotes: content.upvotes,
            downvotes: content.downvotes,
            hasUpvoted: vote.upvotes > 0,
            hasDownvoted: vote.downvotes > 0
        }); 
    } catch (error) {
        console.error("Error in /content_vote:", error);
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

let postUpload
if (process.env.NODE_ENV === 'production') {
	postUpload = multer({
		fileFilter: postFilter,
		storage: multer.memoryStorage()
	})
} else {
	const postStorage = multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, mediaDir)
		},
		filename: (req, file, cb) => {
			const uniqueFilename = `${v4()}${path.extname(file.originalname).toLowerCase()}`
			cb(null, uniqueFilename)
		}
	})
	postUpload = multer({
		fileFilter: postFilter,
		storage: postStorage
	})
}

//Unified route for creating and editing posts and drafts
router.post("/create_post", standardLimiter, authenticateCheck, checkStorageLimit, postUpload.array("files"), async (req, res) => {
	try {
		let { channel_id, content, draft_id, feed_id, is_private, parent_id, post_id, poster_id, title } = req.body;
        if (draft_id === 'null' || draft_id === 'undefined') { //If draft_id is received as the string 'null'
            draft_id = null;        
		}
		if (post_id === 'null' || post_id === 'undefined') { //If post_id is received as the string 'null'
            post_id = null;        
		}
		content = content || "";
		const $ = cheerio.load(content, { decodeEntities: false });
		//Extract and store image and video contents from html, then adjust html with new url
		const mediaElements = $("img[src^='blob:'], video[src^='blob:']").toArray();
		for (let i = 0; i < mediaElements.length; i++) {
			const el = mediaElements[i];
			const file = req.files[i];
			if (!file) continue;
			if (process.env.NODE_ENV === "production") {
				const fileName = GenerateFileName(file, "media");
				const s3Key = `content/${fileName}`;
				await UploadToS3(s3Key, file.buffer, file.mimetype);
				const src = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
				if (el.tagName === "img") {
					$(el).attr("src", src).removeAttr("blob:");
				} else {
					$(el).empty().append(`<source src="${src}" type="${file.mimetype}">`);
				}
			} else {
				const fileName = file.filename; 
				const localPath = path.join(mediaDir, fileName);
				if (file.path !== localPath) {
					fs.copyFileSync(file.path, localPath);
				}
				const src = "/" + path.join("media", "content", fileName).replace(/\\/g, "/"); 
				if (el.tagName === "img") {
					$(el).attr("src", src).removeAttr("blob:");
				} else {
					$(el).empty().append(`<source src="${src}" type="${file.mimetype}">`);
				}
			}
		}
		const finalHtml = $.html();
		let contentUrl;
		//Storage location depends on production or testing
		if (process.env.NODE_ENV === "production") {
			const htmlFileName = GenerateFileName({ originalname: "post.html" }, "post");
			const s3Key = `posts/${htmlFileName}`;
			await UploadToS3(s3Key, Buffer.from(finalHtml), "text/html");
			contentUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
		} else {
			const htmlFileName = GenerateFileName({ originalname: "post.html" }, "post");
			const localPath = path.join(postsDir, htmlFileName);
			fs.writeFileSync(localPath, finalHtml);
			contentUrl = `/media/posts/${htmlFileName}`;
		}
		let result;
		if (draft_id) {
			const existingDraft = await PostDrafts.findByPk(draft_id);
			if (existingDraft && existingDraft.content) {
				await UpdateMediaFiles(existingDraft.content, contentUrl);
			}
			result = await PostDrafts.upsert({
				draft_id,
				feed_id,
				channel_id,
				parent_id: parent_id || null,
				content: contentUrl,
				title: title || null,
				poster_id
			});
		} else {
			const analysisResults = await contentAnalyser.analyseContent(finalHtml, title); //Post analysis for use in recommendation algorithms
			let post = null;
			if (post_id) {
				post = await Posts.findByPk(post_id);
			}
			if (post) {
				if (post.content) {
					await UpdateMediaFiles(post.content, contentUrl);
				}
				post.content = contentUrl;
				if (title) post.title = title;
				if (channel_id) post.channel_id = channel_id;
				if (feed_id) post.feed_id = feed_id;
				if (parent_id) post.parent_id = parent_id;
				post.updated_at = Sequelize.literal("CURRENT_TIMESTAMP(3)");
				await post.save();
			} else {
				if (!post_id) post_id = v4();
				const postData = {
					post_id,
					channel_id,
					content: contentUrl,
					feed_id,
					is_private,
					parent_id,
					poster_id,
					title,
					...analysisResults
				};
				post = await Posts.create(postData);
				if (parent_id) {
					const parentPost = await Posts.findOne({ where: { post_id: parent_id } });
					if (parentPost) {
						parentPost.replies += 1;
						await parentPost.save();
					}
				}
			}
			result = post;
		}
		return res.status(200).json({ success: true, result });
	} catch (error) {
		if (req.files && req.files.length > 0) {
			for (const file of req.files) {
				try {
					if (process.env.NODE_ENV === "production") {
						await DeleteFromS3(`content/${file.filename}`);
					} else {
						fs.existsSync(file.path) && fs.unlinkSync(file.path);
					}
				} catch (cleanupErr) {
					console.error("Failed to cleanup file:", cleanupErr);
				}
			}
		}
		console.error("Error in /create_post:", error);
		return res.status(500).json({ success: false, message: "Error creating post" });
	}
});

router.post("/explore_posts", standardLimiter, async (req, res) => {
    try {
		const { exclude = [], followedFeedIds, recentUpvotes, limit = 50, offset = 0 } = req.body;
		const viewerId = req?.session?.viewer_id || null;
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
            excludedPostIds: exclude,
            feedId: null,
			followedFeedIds,
            includeOptions: includeOptions,
            isMain: 'false',
            limit: limit,
            offset: offset,
			recentUpvotes,
            viewerId,
        });
        res.status(200).json({ posts: posts, hasMore: posts.length === limit });
    } catch (error) {
        console.error("Error in /explore_posts:", error);
        res.status(500).json({ success: false, message: 'Error fetching explore posts.' });
    }
});

router.get('/get_post_drafts', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { channel_id, poster_id, limit = 50, offset = 0 } = req.query;
        const drafts = await PostDrafts.findAll({
            where: { channel_id, poster_id },
            order: [['updated_at','DESC']],
            limit: parseInt(limit,  10),
            offset: parseInt(offset, 10)
        });
        return res.status(200).json({ drafts });
    } catch (error) {
        console.error("Error in /get_post_drafts:", error);   
        return res.status(500).json({ success: false, error: 'Failed to load drafts' });
    }
});

const DeleteBuilds = async html => {
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

router.delete('/remove_build', standardLimiter, authenticateCheck, async (req, res) => {
		const { buildId } = req.body;
		if (!buildId) {
			return res.status(400).json({ success: false, message: 'Missing buildId' });
		}
		try {
			await DeleteBuilds(`<div data-buildid="${buildId}"></div>`);
			return res.status(200).json({ success: true });
		} catch (error) {
			return res.status(500).json({ success: false });
		}
	}
);

router.delete('/remove_draft', standardLimiter, authenticateCheck, async (req, res) => {
    let transaction;
	try {
        transaction = await sequelize.transaction();
		const { draft, isPosting } = req.body;
		const foundDraft = await PostDrafts.findByPk(draft.draft_id);
		if (foundDraft) {
			await DeleteMedia(foundDraft.content);
			if (!isPosting) await DeleteBuilds(foundDraft.content, { transaction }); //Prevents build removal when posting drafts
			await PostDrafts.destroy({ where: { draft_id: draft.draft_id } });
		}
        await transaction.commit();
		return res.status(200).json({ success: true });
	} catch (error) {
        if (transaction) await transaction.rollback();
		console.error("Error in /remove_draft:", error);
		return res.status(500).json({ success: false });
	}
});

router.delete('/remove_post', standardLimiter, authenticateCheck, async (req, res) => {
	let transaction;
	try {
		transaction = await sequelize.transaction();
		const { post } = req.body;
		const foundPost = await Posts.findByPk(post.post_id);
		if (foundPost) {
			await DeleteMedia(foundPost.content);
			await DeleteBuilds(foundPost.content, { transaction });
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
		console.error("Error in /remove_post:", error);
		return res.status(500).json({ success: false });
	}
});

router.post('/increment_views', higherLimiter, authenticateCheck, async (req, res) => {
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
			await existingView.save({ transaction });
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
		console.error("Error in /increment_views:", error);
        res.status(500).json({ success: false, message: 'Error incrementing views.' });   
    }
});

router.get('/post_replies/:postId', standardLimiter, async (req, res) => {
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

router.post('/upload_build', standardLimiter, authenticateCheck, upload.single('build'), async (req, res) => {
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