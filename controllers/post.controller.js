import Post from '../models/post.model.js';

const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching posts', error: error.message });
  }
};

const createPost = async (req, res) => {
  try {
    const { title, body, author, subreddit } = req.body;

    if (!title || !author || !subreddit) {
      return res.status(400).json({ message: 'Title, Author, and Subreddit are required.' });
    }

    const newPost = new Post({
      title,
      body,
      author,
      subreddit,
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (error) {
    res.status(400).json({ message: 'Error creating post', error: error.message });
  }
};

const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching post', error: error.message });
  }
};

const updatePostVotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;

    let updateOperation;

    if (voteType === 'up') {
      updateOperation = { $inc: { votes: 1 } };
    } else if (voteType === 'down') {
      updateOperation = { $inc: { votes: -1 } };
    } else {
      return res.status(400).json({ message: "Invalid vote type. Must be 'up' or 'down'." });
    }

    const updatedPost = await Post.findByIdAndUpdate(id, updateOperation, { new: true });

    if (!updatedPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(400).json({ message: 'Error updating votes', error: error.message });
  }
};

export { getAllPosts, createPost, getPostById, updatePostVotes };
