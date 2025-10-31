import express from 'express';
import {getAllPosts, createPost, getPostById, updatePostVotes} from '../controllers/post.controller.js';

const router = express.Router();

router.get('/', getAllPosts);
router.post('/', createPost);
router.get('/:id', getPostById);
router.patch('/:id/vote', updatePostVotes);

export default router;
