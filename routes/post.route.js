import express from 'express';
import {getAllPosts, createPost, getPostById, updatePostVotes, getPostsBySubreddit, getPostsByTitle} from '../controllers/post.controller.js';

const router = express.Router();

router.get('/', getAllPosts);
router.post('/', createPost);
router.get('/subreddit/:subreddit', getPostsBySubreddit);
router.get('/title/:title', getPostsByTitle);
router.get('/:id', getPostById);
router.patch('/:id/vote', updatePostVotes);

export default router;
