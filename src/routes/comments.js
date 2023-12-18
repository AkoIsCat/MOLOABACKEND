const express = require('express');
const router = express.Router();

// 데이터베이스 연결 객체를 받을 변수 선언
let db;

// 데이터베이스 연결 객체를 설정하는 함수
function setDatabaseConnection(database) {
  db = database;
}

// 댓글 조회
router.get('/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;

    // 쿼리: 게시글에 해당하는 댓글 및 대댓글 조회
    const getCommentsQuery = `
      SELECT * FROM comments
      WHERE post_id = ? AND parent_comment_id IS NULL
      ORDER BY created_at DESC
    `;

    const [commentsData] = await db.query(getCommentsQuery, [postId]);

    // 각 댓글에 대댓글 추가
    const commentsWithReplies = await Promise.all(
      commentsData.map(async (comment) => {
        const getRepliesQuery = `
          SELECT * FROM comments
          WHERE parent_comment_id = ?
          ORDER BY created_at ASC
        `;

        const [repliesData] = await db.query(getRepliesQuery, [
          comment.comment_id,
        ]);

        // Format date for the main comment
        comment.created_at = formatKoreanDate(comment.created_at);

        // Format date for each reply
        const formattedReplies = repliesData.map((reply) => {
          reply.created_at = formatKoreanDate(reply.created_at);
          return reply;
        });

        return { ...comment, replies: formattedReplies };
      })
    );

    res.status(200).json(commentsWithReplies);
  } catch (error) {
    console.error('댓글 조회 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 댓글 및 대댓글 추가
router.post('/', async (req, res) => {
  try {
    const { post_id, user_id, parent_comment_id, content } = req.body;

    // user_id를 사용하여 사용자의 닉네임 조회
    const selectNicknameQuery = 'SELECT nickname FROM members WHERE userid = ?';
    const [nicknameResult] = await db.query(selectNicknameQuery, [user_id]);

    if (nicknameResult.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const user_nk = nicknameResult[0].nickname;

    const insertCommentQuery = `
      INSERT INTO comments (post_id, user_id, parent_comment_id, content, created_at, user_nk)
      VALUES (?, ?, ?, ?, NOW(), ?)
    `;

    const result = await db.query(insertCommentQuery, [
      post_id,
      user_id,
      parent_comment_id,
      content,
      user_nk,
    ]);

    // 해당 게시글의 댓글 수 증가
    const incrementCommentCountQuery =
      'UPDATE board_posts SET comment_count = comment_count + 1 WHERE post_id = ?';
    await db.query(incrementCommentCountQuery, [post_id]);

    res.status(201).json({
      comment_id: result.insertId,
      message: '댓글이 성공적으로 추가되었습니다.',
    });
  } catch (error) {
    console.error('댓글 추가 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

// Function to format date to Korean format
function formatKoreanDate(dateString) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  };

  const date = new Date(dateString);
  return date
    .toLocaleString('ko-KR', options)
    .replace(/(\d+)\. (\d+)\. (\d+)\./, '$1-$2-$3');
}

router.patch('/:commentId', async (req, res) => {
  try {
    const commentId = req.params.commentId;

    // 댓글 내용을 '삭제된 댓글 입니다.'로 변경하는 쿼리
    const updateCommentQuery = `
      UPDATE comments
      SET content = '삭제된 댓글 입니다.', is_deleted = true
      WHERE comment_id = ?
    `;

    await db.query(updateCommentQuery, [commentId]);

    res.status(200).json({ message: '댓글이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('댓글 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = {
  router,
  setDatabaseConnection,
};
