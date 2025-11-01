import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.route.js';
import postRoutes from './routes/post.route.js';
import commentRoutes from './routes/comment.route.js';
import searchRoutes from './routes/search.route.js';
import { ensureCollections } from './config/qdrant.js';
import { syncDataToQdrant } from './services/loader.js';
import { searchBurrow } from './services/search.js';
import { addPost } from './services/post.js';
const app = express();

dotenv.config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

await ensureCollections();

app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
// app.use('/api/search', searchRoutes);

app.get("/api/search", async (req, res) => {
  console.log(req.query);
  
  const q = req.query.query;
  const results = await searchBurrow(q);
  res.json(results);
});

app.post("/api/addPost", async (req, res) => {
  const post = await addPost(req.body);
  res.json(post);
});

app.get("/api/sync", async (req, res) => {
  await syncDataToQdrant();
  res.send("Synced data to Qdrant");
});

app.get('/api/health', (req, res) => {
  res.send('API is running');
});

mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});