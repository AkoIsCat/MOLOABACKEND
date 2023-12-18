const express = require('express');
const router = express.Router();

// 데이터베이스 연결 객체를 받을 변수 선언
let db;

// 데이터베이스 연결 객체를 설정하는 함수
function setDatabaseConnection(database) {
  db = database;
}

// 로그인 라우트
router.post('/login', async (req, res) => {
  const { id, password } = req.body;

  try {
    // Check if the id and password match an entry in the database
    const [results] = await db.query(
      'SELECT * FROM members WHERE userid = ? AND password = ?',
      [id, password]
    );

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ success: 'Login successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 회원가입 라우트
router.post('/signup', async (req, res) => {
  const { id, password, nickname } = req.body;

  try {
    // Check if the id already exists in the database
    const [idResults] = await db.query(
      'SELECT * FROM members WHERE userid = ?',
      [id]
    );

    if (idResults.length > 0) {
      return res.status(409).json({ error: 'ID already exists' });
    }

    // Check if the nickname already exists in the database
    const [nicknameResults] = await db.query(
      'SELECT * FROM members WHERE nickname = ?',
      [nickname]
    );

    if (nicknameResults.length > 0) {
      return res.status(409).json({ error: 'Nickname already exists' });
    }

    // Insert the new user into the database
    await db.query(
      'INSERT INTO members (userid, password, nickname) VALUES (?, ?, ?)',
      [id, password, nickname]
    );

    res.status(201).json({ success: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 사용자 닉네임 조회 라우트
router.get('/getNickname', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID not found in localStorage' });
  }

  try {
    // DB에서 사용자의 닉네임 조회
    const [results] = await db.query(
      'SELECT nickname FROM members WHERE userid = ?',
      [userId]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Nickname not found' });
    }

    const nickname = results[0].nickname;
    res.json({ nickname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = {
  router,
  setDatabaseConnection,
};
