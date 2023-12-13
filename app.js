import { createServer } from 'http';
import { dirname } from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { json, urlencoded } from 'express';
import path from 'path';
import { Server } from 'socket.io';
import session from 'express-session';
import authentication from './routes/authentication.js';
import commentsLoad from './routes/commentsLoad.js';
import directMessages from './routes/directMessages.js';
import groups from './routes/groups.js';
import profiles from './routes/profiles.js';
import routes from './routes/routes.js';
import sequelize  from './databaseSetup.js';
import utils from './routes/utils.js';

const app = express();
const http = createServer(app);
const io = new Server(http);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(json());
app.use(urlencoded({ extended: true}));
app.use(express.static(__dirname + '/public'));
app.use('/static', express.static(join(__dirname, 'static')));
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'EDIT-ME',
    resave: false,
    saveUninitialized: true,
}));

//file imports
app.use('/', authentication);
app.use('/', commentsLoad);
app.use('/', directMessages);
app.use('/', groups);
app.use('/profiles', profiles);
app.use('/', routes);
app.use('/', utils);

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