import { AppBuilds, Feeds, FeedChannels, Posts, PostDrafts, PostNotes, PostVotes, SavedPosts, Users, ViewedPosts } from '../models/relationships.js';
import { ApplyAlgorithm } from '../custom_algorithms/applyAlgorithm.js';
import authenticateCheck from '../functions/checks/authenticateCheck.js';
import cheerio from 'cheerio';
import { ContentAnalyser } from '../functions/contentAnalyser.js';
import { DeleteFromS3, UploadToS3 } from '../functions/media_handling/s3Handling.js';
import DeleteMedia from '../functions/media_handling/deleteMedia.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GenerateFileName } from '../functions/media_handling/generateFileName.js';
import multer from 'multer';
import { Op, Sequelize } from 'sequelize';
import { Router } from 'express';
import path from 'path';
import sequelize from '../databaseSetup.js';
import { standardLimiter, higherLimiter } from '../functions/checks/limiters.js';
import unzipper from 'unzipper';
import { computeHotness, updateHotnessRedis } from '../functions/postRanking.js';
import UpdateMediaFiles from '../functions/media_handling/updateMediaFiles.js';
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
        const maxStorage = user.has_membership ? 30 * 1024 : 300; //Weekly limit of 30GB for members, 300MB for non-members
        if (user.storage_count >= maxStorage) {
            return res.status(413).json({ success: false, message: `Weekly limit of ${maxStorage}MB exceeded` });
        }
        req.currentUser = user;
        next();
    } catch (error) {
		console.error(new Date().toISOString(), 'Error checking storage limit:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

router.post('/channel_posts', standardLimiter, async (req, res) => {
	try {
		const { channelId, feedId, isGroup, isMain, isSingle, postId, limit = 100, offset = 0, recentUpvotes } = req.body;
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
				return res.status(404).json({ success: false, message: 'Post not found' });
			}
			const voteRow = viewerId
				? await PostVotes.findOne({
					attributes: ['upvotes', 'downvotes'],
					where: { post_id: postId, voter_id: viewerId },
					raw: true
				})
				: null;
			singlePost.dataValues.has_upvoted = voteRow ? voteRow.upvotes > 0 : false;
			singlePost.dataValues.has_downvoted = voteRow ? voteRow.downvotes > 0 : false;
			const existing = viewerId
				? await SavedPosts.findOne({ where: { post_id: postId, saver_id: viewerId } })
				: null;

			singlePost.dataValues.is_saved = Boolean(existing);
			return res.status(200).json({ success: true, post: singlePost });
		}
		const algorithmResult = await ApplyAlgorithm({
			locationId: channelId,
			feedId,
			includeOptions,
			isGroup,
			isMain,
			limit,
			offset,
			recentUpvotes,
			viewerId
		});
		const posts = algorithmResult.posts;
		const status = algorithmResult.status;
		const message = algorithmResult.message;
		return res.status(200).json({
			success: true,
			posts: posts,
			bstatus: status,
			bmessage: message
		});
	} catch (error) {
		console.error(new Date().toISOString(), '/channel_posts error:', error);
		return res.status(500).json({ success: false, message: 'Error getting posts.' });
	}
});

router.post('/content_vote', higherLimiter, authenticateCheck, async (req, res) => {
	const transaction = await sequelize.transaction();
	try {
		const { feedId, postId, voteType } = req.body;
		const content = await Posts.findByPk(postId, {
			transaction,
			lock: transaction.LOCK.UPDATE
		});
		if (!content) {
			await transaction.rollback();
			return res.status(404).json({ success: false, message: 'Content not found' });
		}
		const [vote] = await PostVotes.findOrCreate({
			where: { post_id: postId, voter_id: feedId },
			defaults: { vote_id: v4(), upvotes: 0, downvotes: 0 },
			transaction,
		});
		const prevDownvotes = vote.downvotes;
		const prevUpvotes = vote.upvotes;
		if (voteType === 'upvote') {
			vote.upvotes = prevUpvotes ? 0 : 1;
			vote.downvotes = 0;
		}
		if (voteType === 'downvote') {
			vote.downvotes = prevDownvotes ? 0 : 1;
			vote.upvotes = 0;
		}
		const deltaDownvotes = vote.downvotes - prevDownvotes;
		const deltaUpvotes = vote.upvotes - prevUpvotes;
		content.upvotes += deltaUpvotes;
		content.downvotes += deltaDownvotes;
		await vote.save({ transaction });
		await content.save({ transaction });
		const newHotness = computeHotness({
			upvotes: content.upvotes,
			downvotes: content.downvotes,
			createdAt: content.created_at,
			referenceTime: Math.floor(Date.now() / 1000),
			boost: content.boost_amount
		});
		await Posts.update(
			{ rank_hotness: newHotness, rank_updated_at: new Date() },
			{ where: { post_id: postId }, transaction }
		);
		await transaction.commit();
		return res.status(200).json({
			success: true,
			upvotes: content.upvotes,
			downvotes: content.downvotes,
			hasUpvoted: vote.upvotes === 1,
			hasDownvoted: vote.downvotes === 1
		});
	} catch (error) {
		await transaction.rollback();
		console.error(new Date().toISOString(), '/content_vote error:', error);
		return res.status(500).json({ success: false });
	}
});

//Checks individual file sizes
const postFilter = (req, file, cb) => {
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
	const extname = path.extname(file.originalname).toLowerCase();
	const isValidExtension = ALLOWED_EXTENSIONS.includes(extname);
	const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.mimetype);
	if (!isValidExtension || !isValidMimeType) {
		return cb(new Error('File type not allowed'));
	}
	const isVideo = file.mimetype.startsWith('video/');
	const maxImageSize = (req.session?.user?.has_membership ? 500 : 5) * 1024 * 1024; //500MB vs 5MB
	const maxVideoSize = (req.session?.user?.has_membership ? 10000 : 100) * 1024 * 1024; //10GB vs 100MB
	const maxSize = isVideo ? maxVideoSize : maxImageSize;
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
        let { boost_amount, channel_id, content, draft_id, feed_id, is_private, parent_id, post_id, poster_id, title, publish_draft } = req.body;
        if (draft_id === 'null' || draft_id === 'undefined') draft_id = null;
        if (post_id === 'null' || post_id === 'undefined') post_id = null;
        content = content || "";
        //Parse HTML content
        const $ = cheerio.load(content, { decodeEntities: false });
        //Handle local media uploads
        const mediaElements = $("img[src^='blob:'], video source[src^='blob:']").toArray();
        for (let i = 0; i < mediaElements.length; i++) {
            const el = mediaElements[i];
            const file = req.files[i];
            if (!file) continue;
            if (process.env.NODE_ENV === "production") {
                const fileName = GenerateFileName(file, "media");
				const s3Key = `content/${fileName}`; //Content folder of S3 bucket
                await UploadToS3(s3Key, file.buffer, file.mimetype);
                const src = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
                $(el).attr("src", src).removeAttr("blob:");
            } else {
                const fileName = file.filename;
                const localPath = path.join(mediaDir, fileName);
                if (file.path !== localPath) fs.copyFileSync(file.path, localPath);
                const src = "/" + path.join("media", "content", fileName).replace(/\\/g, "/");
                $(el).attr("src", src).removeAttr("blob:");
            }
        }
        //Generate and store final HTML
        const finalHtml = $.html();
        let contentUrl;
        const htmlFileName = GenerateFileName({ originalname: "post.html" }, "post");
        if (process.env.NODE_ENV === "production") {
            const s3Key = `posts/${htmlFileName}`;
            await UploadToS3(s3Key, Buffer.from(finalHtml), "text/html");
            contentUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
        } else {
            const localPath = path.join(postsDir, htmlFileName);
            fs.writeFileSync(localPath, finalHtml);
            contentUrl = `/media/posts/${htmlFileName}`;
        }
        //Run text/embedding analysis
        const textBody = await contentAnalyser.extractTextBody(finalHtml);
        const embedding = await contentAnalyser.generateEmbedding(textBody);
        const textProcessing = await contentAnalyser.processText(textBody);
        const sentimentScore = await contentAnalyser.calculateSentiment(textBody);
        const words = textBody.split(/\s+/).filter(w => w.length > 0);
        const sentences = textBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const analysis = {
            embeddings: embedding,
            sentiment_score: sentimentScore,
            sentence_count: sentences.length,
            text_body: textBody,
            text_length: textBody.length,
            tokens: textProcessing.tokens,
            word_count: words.length
        };
        const flags = {
            has_images: req.body.has_images === 'true' || req.body.has_images === true,
            has_interactive: req.body.has_interactive === 'true' || req.body.has_interactive === true,
            has_text: req.body.has_text === 'true' || req.body.has_text === true,
            has_videos: req.body.has_videos === 'true' || req.body.has_videos === true,
            image_count: parseInt(req.body.image_count ?? 0) || 0,
            video_count: parseInt(req.body.video_count ?? 0) || 0,
            video_length: parseFloat(req.body.video_length ?? 0) || 0
        };
        let result = null;
        //Update existing post
        if (post_id) {
            const post = await Posts.findByPk(post_id);
            if (post) {
                await UpdateMediaFiles(post.content, contentUrl);
                post.content = contentUrl;
				post.title = title; //New post might not have title
                if (channel_id) post.channel_id = channel_id;
                if (feed_id) post.feed_id = feed_id;
                if (parent_id) post.parent_id = parent_id;
                if (boost_amount) post.boost_amount = boost_amount;
                Object.assign(post, analysis, flags);
                post.updated_at = Sequelize.literal("CURRENT_TIMESTAMP(3)");
                await post.save();
                result = post;
            }
        }
        //Publish draft as post
        else if (draft_id && publish_draft === 'true') {
            const draft = await PostDrafts.findByPk(draft_id);
            const newPostId = v4();
            const postData = {
                post_id: newPostId,
                channel_id,
                content: contentUrl,
                feed_id,
                is_private,
                parent_id,
                poster_id,
                title,
                rank_hotness: -0.1,
                boost_amount,
                ...analysis,
                ...flags
            };
            result = await Posts.create(postData);
            await Feeds.increment('post_count', { by: 1, where: { feed_id } });
            await FeedChannels.increment('post_count', { by: 1, where: { channel_id } });
            if (draft) await PostDrafts.destroy({ where: { draft_id } });
        }
        //Create or update draft
        else if (draft_id) {
            const existingDraft = await PostDrafts.findByPk(draft_id);
            if (existingDraft?.content) await UpdateMediaFiles(existingDraft.content, contentUrl);
            result = await PostDrafts.upsert({
                draft_id,
                feed_id,
                channel_id,
                parent_id: parent_id || null,
                content: contentUrl,
                title: title || null,
                poster_id
            });
        }
        //Create new post
        else {
            const newPostId = v4();
            const postData = {
                post_id: newPostId,
                channel_id,
                content: contentUrl,
                feed_id,
                is_private,
                parent_id,
                poster_id,
                title,
                rank_hotness: -0.1,
                boost_amount,
                ...analysis,
                ...flags
            };
            result = await Posts.create(postData);
			console.log("/create_post result:", result);
            await Feeds.increment('post_count', { by: 1, where: { feed_id } });
            await FeedChannels.increment('post_count', { by: 1, where: { channel_id } });
            if (parent_id) {
                const parentPost = await Posts.findOne({ where: { post_id: parent_id } });
                if (parentPost) {
                    parentPost.replies += 1;
                    await parentPost.save();
                }
            }
        }
        return res.status(200).json({ success: true, result });
    } catch (error) {
        if (req.files?.length > 0) {
            for (const file of req.files) {
                try {
                    if (process.env.NODE_ENV === "production") {
                        await DeleteFromS3(`content/${file.filename}`);
                    } else if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (cleanupErr) {
                    console.error(new Date().toISOString(), 'Failed to cleanup file:', cleanupErr);
                }
            }
        }
        console.error(new Date().toISOString(), '/create_post error:', error);
        return res.status(500).json({ success: false, message: "Error creating post" });
    }
});

router.post("/explore_posts", standardLimiter, async (req, res) => {
    try {
        const { followedFeedIds, recentUpvotes, limit = 100, offset = 0 } = req.body;
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
		const algorithmResult = await ApplyAlgorithm({
			locationId: 'explore',
			feedId: null,
			followedFeedIds,
			includeOptions: includeOptions,
			isMain: 'false',
			limit: limit,
			offset: offset,
			recentUpvotes,
			viewerId,
		});
		const posts = algorithmResult.posts;
		//console.log("Explore posts fetched:", posts);
		const status = algorithmResult.status;
		const message = algorithmResult.message;
		res.status(200).json({ hasMore: posts.length >= limit, posts: posts, status: status, message: message });
    } catch (error) {
        console.error(new Date().toISOString(), '/explore_posts error:', error);
        res.status(500).json({ success: false, message: 'Error fetching explore posts.' });
    }
});

router.get('/get_post_drafts', standardLimiter, authenticateCheck, async (req, res) => {
    try {
        const { channel_id, poster_id, limit = 100, offset = 0 } = req.query;
        const drafts = await PostDrafts.findAll({
            where: { channel_id, poster_id },
            order: [['updated_at','DESC']],
            limit: parseInt(limit,  10),
            offset: parseInt(offset, 10)
        });
        return res.status(200).json({ drafts });
    } catch (error) {
        console.error(new Date().toISOString(), '/get_post_drafts error:', error);   
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
			console.error(new Date().toISOString(), '/remove_build error:', error);
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
		console.error(new Date().toISOString(), '/remove_draft error:', error);
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
			await SavedPosts.destroy({ where: { post_id: post.post_id }, transaction });
			await ViewedPosts.destroy({ where: { post_id: post.post_id }, transaction });
			await Posts.destroy({ where: { post_id: post.post_id }, transaction });
			await Feeds.decrement('post_count', { by: 1, where: { feed_id: foundPost.feed_id }, transaction });
			await FeedChannels.decrement('post_count', { by: 1, where: { channel_id: foundPost.channel_id }, transaction });
		}
		await transaction.commit();
		return res.status(200).json({ success: true });
	} catch (error) {
		if (transaction) await transaction.rollback();
		console.error(new Date().toISOString(), '/remove_post, error:', error);
		return res.status(500).json({ success: false });
	}
});

router.post('/increment_views', higherLimiter, authenticateCheck, async (req, res) => {
    try {
        const { postId } = req.body;
		const existingView = await ViewedPosts.findOne({
			where: { post_id: postId, viewer_id: req.session.viewer_id }
		});
		if (existingView && existingView.views >= 100) { //Cap at 100 views per user
			return res.status(200).json({ success: true });
		}
        const post = await Posts.findByPk(postId);
		post.views += 1;
        await post.save();
		const newHotness = computeHotness({
			upvotes: post.upvotes || 0,
			downvotes: post.downvotes || 0,
			createdAt: post.created_at,
			referenceTime: Math.floor(Date.now() / 1000),
			boost: post.boost_amount
		});
		await Posts.update({ rank_hotness: newHotness, rank_updated_at: new Date() }, { where: { post_id: postId } });
		if (existingView) {
			existingView.views += 1;
			await existingView.save();
		} else {
			await ViewedPosts.create({
				post_id: postId,
				viewer_id: req.session.viewer_id,	
				views: 1
			});
		}
        res.status(200).json({ success: true });
    } catch (error) {
		console.error(new Date().toISOString(), '/increment_views error:', error);
        res.status(500).json({ success: false, message: 'Error incrementing views.' });   
    }
});

router.get('/post_replies/:postId', standardLimiter, async (req, res) => {
    try {
        const { postId } = req.params;
        const viewerId = req?.session?.viewer_id || null;
        const parentPost = await Posts.findOne({ where: { post_id: postId } });
        if (!parentPost) return res.status(404).json({ success: false, message: 'Parent post not found.' });
        const includeOptions = [
            { model: Feeds, as: 'poster' },
            { model: PostVotes, as: 'votes', required: false },
            { model: PostNotes, as: 'note', required: false },
            {
                model: FeedChannels,
                as: 'parentChannel',
                attributes: ['channel_name', 'channel_id'],
                required: false,
                include: [{ model: Feeds }]
            }
        ];
        const replies = await Posts.findAll({
            where: {
                parent_id: postId,
                feed_id: parentPost.feed_id,
                channel_id: parentPost.channel_id
            },
            include: includeOptions,
            order: [['created_at', 'DESC']]
        });
        const viewerVotes = viewerId
            ? await PostVotes.findAll({
                attributes: ['post_id', 'upvotes', 'downvotes'],
                where: { post_id: { [Op.in]: replies.map(r => r.post_id) }, voter_id: viewerId },
                raw: true
            })
            : [];
        const voteMap = new Map(viewerVotes.map(v => [
            v.post_id, { has_upvoted: v.upvotes > 0, has_downvoted: v.downvotes > 0 }
        ]));
        const formattedReplies = replies.map(reply => {
            const votes = reply.votes?.dataValues || { upvotes: 0, downvotes: 0 };
            const viewerVote = voteMap.get(reply.post_id) || { has_upvoted: false, has_downvoted: false };
            return {
                ...reply.dataValues,
				upvotes: reply.dataValues.upvotes || 0,
				downvotes: reply.dataValues.downvotes || 0,
                ...viewerVote,
                has_viewed: false
            };
        });
        return res.status(200).json(formattedReplies);
    } catch (error) {
        console.error(new Date().toISOString(), '/post_replies error:', error);
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
		console.error(new Date().toISOString(), '/upload_build error:', error);
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