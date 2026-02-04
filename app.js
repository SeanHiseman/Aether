import algorithmRoutes from './custom_algorithms/algorithmRoutes.js'; 
import ask from './routes/ask.js';
import authentication from './routes/authentication.js';
import content from './routes/content.js';
import { connectRequestsSocket } from './routes/directMessages.js';
import cors from 'cors';
import { createServer } from 'http';
import directMessages, { directMessagesSocket } from './routes/directMessages.js';
import { dirname } from 'path';
import dotenv from 'dotenv';
import express from 'express';
import favicon from 'serve-favicon';
import feeds, { feedChatChannelSocket } from './routes/feeds.js';
import { fileURLToPath } from 'url';
import { handleStripeWebhook } from './routes/webhookHandler.js';
import history from 'express-history-api-fallback';
import passport from 'passport';
import path from 'path';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import routes from './routes/routes.js';
import { Server } from 'socket.io';
import session from 'express-session';
import sequelize  from './databaseSetup.js';
import socialConnect from './routes/socialConnect.js';
import { urlencoded } from 'express';
import users from './routes/users.js';

dotenv.config();
const app = express(); 
const http = createServer(app);
const io = new Server(http, {
    cors: {
        credentials: true,
        methods: ['GET', 'POST'],
        origin: [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5000"],
    },
    transports: ['websocket', 'polling'],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const appBuildPath = path.join(__dirname, process.env.APP_BUILD_DIR);
const faviconPath = path.join(__dirname, process.env.FAVICON_PATH);
const root = path.join(__dirname, process.env.FRONTEND_BUILD_DIR);
const mediaPath = path.join(__dirname, process.env.MEDIA_DIR);

const limiter = rateLimit({ //Highest level limiter
	windowMs: 15 * 60 * 1000,  //15 minutes
	max: 3000,                 //limit each IP to 200 requests per minute
	standardHeaders: true,     
	legacyHeaders: false,     
	message: 'Too many requests, please try again later.'
});
app.use(limiter);

//const redis = new Redis({
	//host: process.env.REDIS_HOST, 
	//port: process.env.REDIS_PORT,
//});

//redis.on('connect', () => {
    //console.log('Connected to Redis');
//});

//redis.on('ready', () => {
    //console.log('Redis is ready for commands');
//});

//redis.on('error', (err) => {
    //console.error('Redis connection error:', err);
//});

//redis.on('end', () => {
    //console.log('Redis connection closed');
//});

app.use('/app_builds', express.static(appBuildPath, {
	setHeaders: res => res.set('Access-Control-Allow-Origin', '*')
}))
app.use('/media', express.static(mediaPath));
app.use(cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5000"],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.static(root));
app.use(favicon(faviconPath));
app.use(urlencoded({ extended: true}));
app.set('trust proxy', 1);
app.use(session({
	secret: process.env.APP_SECRET,
	resave: false,
	saveUninitialized: true,
	cookie: {
		httpOnly: true,
		sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
		secure: process.env.NODE_ENV === 'production' //must be true for https
	}
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/', algorithmRoutes); 
app.use('/api/', ask);
app.use('/api/', authentication);
app.use('/api/', content);
app.use('/api/', directMessages);
app.use('/api/', feeds);
app.use('/api/', routes);
app.use('/api/', socialConnect);
app.use('/api/', users);

app.get('/robots.txt', (req, res) => {
	res.sendFile(path.join(__dirname, 'frontend', 'build', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
	res.sendFile(path.join(__dirname, 'frontend', 'build', 'sitemap.xml'));
});

app.get('*', (req, res, next) => {
	if (
		req.path.startsWith('/app_builds/') ||
		req.path.startsWith('/api/') ||
		req.path.startsWith('/media/') ||
		path.extname(req.path)
	) {
		return next()
	}
	if (req.headers.accept && req.headers.accept.includes('text/html')) {
		return res.sendFile(path.join(root, 'index.html'))
	}
	next()
});

app.use(history('index.html', { root }));
sequelize.authenticate()

io.on("connection", (socket) => {
    // Track which handlers have been registered to prevent duplicates
    socket._handlersRegistered = socket._handlersRegistered || {};

    socket.on('join_user_room', (userId) => {
        if (userId) {
            socket.join(userId.toString());
        }
    });
    socket.on('join_channel_type', (channelType) => {
        try {
            // Only register handlers once per socket connection
            if (socket._handlersRegistered[channelType]) {
                return; // Handlers already registered for this type
            }

            if (channelType === 'direct_message') {
                directMessagesSocket(socket);
                socket._handlersRegistered[channelType] = true;
            } else if (channelType === 'feed_chat') {
                feedChatChannelSocket(socket);
                socket._handlersRegistered[channelType] = true;
            } else if (channelType === 'connect_requests') {
                connectRequestsSocket(socket);
                socket._handlersRegistered[channelType] = true;
            } else {
                console.error("Unknown channel type:", channelType);
            }
        } catch (error) {
            console.error(`Error setting up socket for ${channelType}:`, error);
        }
    });
});

app.set('io', io);

const PORT = process.env.APP_PORT;
console.log(`[app.js] ===== STARTING SERVER =====`);
console.log(`[app.js] Port: ${PORT}`);
console.log(`[app.js] Environment: ${process.env.NODE_ENV}`);
http.listen(PORT, () => {
    console.log(`[app.js] ===== SERVER RUNNING ON PORT ${PORT} =====`)
});

//export default redis;