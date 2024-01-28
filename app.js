import { createServer } from 'http';
import cors from 'cors';
import { dirname } from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { urlencoded } from 'express';
import { Server } from 'socket.io';
import session from 'express-session';
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

app.use(cors());
app.use(express.json());
app.use(urlencoded({ extended: true}));
app.use(express.static(join(__dirname, './frontend/build')));

app.use(session({
    secret: 'EDIT-ME',
    resave: false,
    saveUninitialized: true,
}));

//file imports
app.use('/', profileDataRouter);
app.use('/', authentication);
app.use('/', commentsLoad);
app.use('/', directMessages);
app.use('/', groups);
app.use('/', profiles);
app.use('/', routes);
app.use('/', utils);

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, './frontend/build', 'index.html'));
})

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

