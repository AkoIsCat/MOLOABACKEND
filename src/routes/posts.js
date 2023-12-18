const express = require('express');
const router = express.Router();

// 데이터베이스 연결 객체를 받을 변수 선언
let db;

// 데이터베이스 연결 객체를 설정하는 함수
function setDatabaseConnection(database) {
  db = database;
}

// 모든 게시글 가져오기
router.get('/', async (req, res) => {
  try {
    const query = 'SELECT * FROM board_posts';
    const [rows] = await db.query(query);
    const formattedRows = rows.map((post) => {
      const date = new Date(post.post_date);
      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23',
      };
      const localeDate = date
        .toLocaleString('ko-KR', options)
        .replace(/(\d+)\. (\d+)\. (\d+)\./, '$1-$2-$3');
      return {
        ...post,
        post_date: localeDate,
      };
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res
      .status(500)
      .json({ message: '게시글 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 특정 게시글 가져오기
router.get('/:postId', async (req, res) => {
  const postId = req.params.postId;
  try {
    const postQuery = 'SELECT * FROM board_posts WHERE post_id = ?';
    const likesQuery = 'SELECT user_id FROM post_likes WHERE post_id = ?';
    const [post, likes] = await Promise.all([
      db.query(postQuery, [postId]),
      db.query(likesQuery, [postId]),
    ]);

    if (post.length === 0) {
      res.status(404).json({ message: '해당 게시글을 찾을 수 없습니다.' });
      return;
    }

    // 현재 view_count 값
    const currentViewCount = post[0][0].view_count;

    // view_count를 1 증가시키는 UPDATE 쿼리
    const updateQuery =
      'UPDATE board_posts SET view_count = ? WHERE post_id = ?';
    await db.query(updateQuery, [currentViewCount + 1, postId]);

    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    };

    const date = new Date(post[0][0].post_date);
    const localeDate = date
      .toLocaleString('ko-KR', options)
      .replace(/(\d+)\. (\d+)\. (\d+)\./, '$1-$2-$3');

    const postData = post[0][0];
    const newPostData = { ...postData, post_date: localeDate };

    if (post.length === 0) {
      res.status(404).json({ message: '해당 게시글을 찾을 수 없습니다.' });
    } else {
      res.status(200).json({ post: newPostData, likes: likes[0] });
    }
  } catch (error) {
    console.error('Error fetching a post:', error);
    res
      .status(500)
      .json({ message: '게시글을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 게시글 작성하기
router.post('/', async (req, res) => {
  try {
    const postTitle = req.body.post_title;
    const postContents = req.body.post_contents;
    const writer_id = req.body.id;

    // 사용자 아이디로 닉네임 조회
    const selectNicknameQuery = 'SELECT nickname FROM members WHERE userid = ?';

    const [nicknameResults] = await db.query(selectNicknameQuery, [writer_id]);

    if (nicknameResults.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const writer_nk = nicknameResults[0].nickname;

    // 게시글 데이터 삽입 쿼리
    const insertQuery =
      'INSERT INTO board_posts (post_title, writer_id, writer_nk, post_contents) VALUES (?, ?, ?, ?)';

    const [results] = await db.query(insertQuery, [
      postTitle,
      writer_id,
      writer_nk,
      postContents,
    ]);

    res.status(200).json({ message: '게시글이 성공적으로 작성되었습니다.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: '오류가 발생했습니다.' });
  }
});

// 게시글 내용 수정
router.put('/:postId', async (req, res) => {
  const postId = req.params.postId;
  const { postTitle, postContents } = req.body;

  try {
    // 게시글 수정 쿼리
    const updatePostQuery =
      'UPDATE board_posts SET post_title = ?, post_contents = ? WHERE post_id = ?';
    await db.query(updatePostQuery, [postTitle, postContents, postId]);

    res.status(200).json({ message: '게시글이 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: '게시글 수정 중 오류가 발생했습니다.' });
  }
});

// 게시글 삭제하기
router.delete('/posts/:postId', async (req, res) => {
  const postId = req.params.postId;

  try {
    // 해당 postId에 해당하는 게시글을 데이터베이스에서 삭제
    const deleteQuery = 'DELETE FROM board_posts WHERE post_id = ?';
    const result = await db.query(deleteQuery, [postId]);

    // 삭제가 성공적으로 이루어졌는지 확인
    if (result[0].affectedRows > 0) {
      res.status(200).json({ message: '게시글이 성공적으로 삭제되었습니다.' });
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }
});

// 좋아요 증가
router.post('/like', async (req, res) => {
  const userId = req.body.userId;
  const postId = req.body.postId;

  // 트랜잭션 시작
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 사용자가 이미 해당 게시글에 좋아요를 눌렀는지 확인
    const checkLikeQuery =
      'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?';
    const [existingLike] = await connection.query(checkLikeQuery, [
      userId,
      postId,
    ]);

    if (existingLike.length > 0) {
      // 사용자가 이미 좋아요를 눌렀으면 트랜잭션 롤백
      await connection.rollback();
      return res.status(400).json({ message: '이미 좋아요를 눌렀습니다.' });
    }

    // 게시글 테이블의 좋아요 수 증가
    const incrementLikeQuery =
      'UPDATE board_posts SET like_count = like_count + 1 WHERE post_id = ?';
    await connection.query(incrementLikeQuery, [postId]);

    // 좋아요 테이블에 새로운 레코드 삽입
    const insertLikeQuery =
      'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)';
    await connection.query(insertLikeQuery, [userId, postId]);

    // 트랜잭션 커밋
    await connection.commit();

    res.status(200).json({ message: '좋아요가 성공적으로 추가되었습니다.' });
  } catch (error) {
    // 에러 발생 시 트랜잭션 롤백
    await connection.rollback();
    console.error('좋아요 추가 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  } finally {
    // 커넥션 반환
    connection.release();
  }
});

module.exports = {
  router,
  setDatabaseConnection,
};
