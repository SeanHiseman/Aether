import { createServer } from 'http';
import cors from 'cors';
import { dirname } from 'path';
import express from 'express';
import favicon from 'serve-favicon';
import { fileURLToPath } from 'url';
import history from 'express-history-api-fallback';
import path from 'path';
import { Server } from 'socket.io';
import session from 'express-session';
import { urlencoded } from 'express';
import authentication from './routes/authentication.js';
import commentsLoad from './routes/commentsLoad.js';
import directMessages from './routes/directMessages.js';
import groups from './routes/groups.js';
import profiles from './routes/profiles.js';
import profileDataRouter from './routes/profileDataRouter.js'
import routes from './routes/routes.js';
import sequelize  from './databaseSetup.js';
import utils from './routes/utils.js';

const app = express();
const http = createServer(app);
const io = new Server(http);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = path.join(__dirname, 'frontend', 'build');

app.use('/media', express.static(path.join(__dirname, 'media')));
app.use(cors());
app.use(express.json());
app.use(express.static(root));
app.use(favicon(path.join(process.cwd(), 'media', 'site_images', 'AetherLogo.png')));
app.use(urlencoded({ extended: true}));

app.use(session({
    secret: 'EDIT-ME',
    resave: false,
    saveUninitialized: true,
}));

// api prefix prevents clashes with React app
app.use('/api/', authentication);
app.use('/api/', commentsLoad);
app.use('/api/', directMessages);
app.use('/api/', groups);
app.use('/api/', profileDataRouter);
app.use('/api/', profiles);
app.use('/api/', routes);
app.use('/api/', utils);

app.use(history('index.html', { root }));

app.get('*', (req, res) => {
    if (req.headers.accept.includes('text/html')) {
        res.sendFile(path.join(__dirname, './frontend/build', 'index.html'));
    } else {
        res.status(404).send('Not found');
    }
});

io.on('connection', (socket) => {
    directMessages(socket);
});

sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.log('Error: ' + err));

//Start server
const PORT = process.env.PORT || 7000;
http.listen(PORT, () =>{
    console.log(`Server running on port ${PORT}`);
});

