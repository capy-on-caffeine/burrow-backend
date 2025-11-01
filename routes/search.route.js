import express from 'express';
import { addPost, searchPosts } from '../controllers/search.controller.js';

const router = express.Router();

router.post('/add', (req, res) => {
  const { title, content } = req.body;
  console.log(title + content);
  
  const post = addPost(title, content);
  res.status(201).json(post);
});
router.get('/', (req, res) => {
  const { query } = req.query;
  console.log(query);  
  const results = searchPosts(query);
  res.status(200).json(results);
});

export default router;
