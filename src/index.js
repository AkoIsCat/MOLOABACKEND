const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentsRoutes = require('./routes/comments');
const db = require('./db');

const app = express();
const port = 8000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CORS 설정
const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

authRoutes.setDatabaseConnection(db);
postRoutes.setDatabaseConnection(db);
commentsRoutes.setDatabaseConnection(db);

app.use('/auth', authRoutes.router);
app.use('/posts', postRoutes.router);
app.use('/comments', commentsRoutes.router);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
