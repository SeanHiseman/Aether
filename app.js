import { createServer } from 'http';
import cors from 'cors';
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
import combined from './routes/combined.js';
import replies from './routes/replies.js';
import directMessages, { directMessagesSocket } from './routes/directMessages.js';
import groups, { groupChatChannelSocket } from './routes/groups.js';
import profiles from './routes/profiles.js';
import routes from './routes/routes.js';
import sequelize  from './databaseSetup.js';

dotenv.config();
const app = express();
const http = createServer(app);
const io = new Server(http);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = path.join(__dirname, process.env.FRONTEND_BUILD_DIR);
const mediaPath = path.join(__dirname, process.env.MEDIA_DIR);
const faviconPath = path.join(__dirname, process.env.FAVICON_PATH);

app.use('/media', express.static(mediaPath));
app.use(cors());
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
app.use('/api/', combined);
app.use('/api/', directMessages);
app.use('/api/', groups);
app.use('/api/', replies);
app.use('/api/', routes);
app.use('/api/', profiles);
app.use(history('index.html', { root }));

app.get('*', (req, res) => {
    if (req.headers.accept.includes('text/html')) {
        res.sendFile(path.join(root, 'index.html'));
    } else {
        res.status(404).json({ success: false });
    }
});

io.on('connection', (socket) => {
    directMessagesSocket(socket);
    groupChatChannelSocket(socket);
});

sequelize.authenticate()

const PORT = process.env.APP_PORT;
http.listen(PORT, () => {});

