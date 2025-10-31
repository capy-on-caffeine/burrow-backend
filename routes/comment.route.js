import express from 'express';
import {
  getCommentsForPost,
  updateCommentVote, // New
  updateCommentText, // New
  deleteComment, // New
} from '../controllers/comment.controller.js';

const router = express.Router();

router.get('/post/:postId', getCommentsForPost);
router.patch('/:id/vote', updateCommentVote);
router.patch('/:id', updateCommentText);
router.delete('/:id', deleteComment);

export default router;