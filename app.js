import cors from 'cors';
import { createServer } from 'http';
import { dirname } from 'path';
import dotenv from 'dotenv';
import express from 'express';
import favicon from 'serve-favicon';
import { fileURLToPath } from 'url';
import history from 'express-history-api-fallback';
import path from 'path';
import { Server } from 'socket.io';
import session from 'express-session';
import { urlencoded } from 'express';
import ask from './routes/ask.js';
import authentication from './routes/authentication.js';
import content from './routes/content.js';
import { connectRequestsSocket } from './routes/directMessages.js';
import directMessages, { directMessagesSocket } from './routes/directMessages.js';
import feeds, { feedChatChannelSocket } from './routes/feeds.js';
import routes from './routes/routes.js';
import users from './routes/users.js';
import sequelize  from './databaseSetup.js';

dotenv.config();
const app = express(); 
const http = createServer(app);
const io = new Server(http, {
    cors: {
        origin: [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5000"],
        methods: ['GET', 'POST'],
        credentials : true  
    },
    transports: ['websocket', 'polling'],
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = path.join(__dirname, process.env.FRONTEND_BUILD_DIR);
const mediaPath = path.join(__dirname, process.env.MEDIA_DIR);
const faviconPath = path.join(__dirname, process.env.FAVICON_PATH);

app.use('/media', express.static(mediaPath));
app.use(cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:3000", "http://localhost:5000"],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(root));
app.use(favicon(faviconPath));
app.use(urlencoded({ extended: true}));
app.use(session({
    secret: process.env.APP_SECRET, 
    resave: false,
    saveUninitialized: true,
}));

app.use('/api/', ask);
app.use('/api/', authentication);
app.use('/api/', content);
app.use('/api/', directMessages);
app.use('/api/', feeds);
app.use('/api/', routes);
app.use('/api/', users);
app.use(history('index.html', { root }));

app.get('*', (req, res) => {
    if (req.headers.accept.includes('text/html')) {
        res.sendFile(path.join(root, 'index.html'));
    } else {
        res.status(404).json({ success: false });
    }
});

sequelize.authenticate()

io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id);
    socket.on('join_user_room', (userId) => {
        if (userId) {
            socket.join(userId.toString());
            console.log(`User ${userId} joined personal room`);
        }
    });
    socket.on('join_channel_type', (channelType) => {
        try {
            if (channelType === 'direct_message') {
                directMessagesSocket(socket);
            } else if (channelType === 'feed_chat') {
                feedChatChannelSocket(socket);
            } else if (channelType === 'connect_requests') {
                connectRequestsSocket(socket); 
            } else {
                console.error("Unknown channel type:", channelType);
            }
        } catch (error) {
            console.error(`Error setting up socket for ${channelType}:`, error);
        }
    });
});

const PORT = process.env.APP_PORT;
const HOST = process.env.APP_HOST;
http.listen(PORT, HOST, () => {
    console.log(`Running on ${PORT}`)
});