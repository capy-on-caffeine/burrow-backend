import express from 'express';
import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.route.js';
import postRoutes from './routes/post.route.js';
import commentRoutes from './routes/comment.route.js';
import searchRoutes from './routes/search.route.js';
const app = express();

const app = express();
const port = 5000;
dotenv.config();

app.use(cors());
app.use(express.json());

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USERNAME;
const PASSWORD = process.env.NEO4J_PASSWORD;

    let driver;

    try {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    console.log('Neo4j connection established.');
    } catch (err) {
    console.error('Neo4j connection error:', err);
    }

app.use(cors());

app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.get('/api/graph', async (req, res) => {
  const session = driver.session();
  const query = `
  MATCH (n:Tag) 
  WITH collect(n) AS allNodes
  OPTIONAL MATCH (n:Tag)-[r:RELATED_TO]->(m:Tag) 
  RETURN allNodes, collect({sourceNode: n, rel: r, targetNode: m}) AS relations
  `;

  try {
  const result = await session.run(query);
  const singleRecord = result.records[0];

  const allNodes = singleRecord.get('allNodes');
  const relations = singleRecord.get('relations');

  const nodesMap = new Map();
  const links = [];
  const connectedNodeIds = new Set(); 

  relations.forEach(relData => {
  if (relData.rel === null) return; 

  const node1 = relData.sourceNode;
  const node2 = relData.targetNode;
  const rel = relData.rel;

  const sourceId = node1.identity.toString();
  const targetId = node2.identity.toString();

  connectedNodeIds.add(sourceId);
  connectedNodeIds.add(targetId);

  if (!nodesMap.has(node1.identity)) {
  nodesMap.set(node1.identity, {
  id: sourceId,
  label: node1.labels[0], 
  ...node1.properties, 
  });
  }
  if (!nodesMap.has(node2.identity)) {
  nodesMap.set(node2.identity, {
  id: targetId,
  label: node2.labels[0], 
  ...node2.properties,  
  });
  }

  links.push({
  source: sourceId,
  target: targetId,
  label: rel.type,        
  ...rel.properties,     
  });
  });

  allNodes.forEach(node => {
  if (!nodesMap.has(node.identity)) {
  nodesMap.set(node.identity, {
  id: node.identity.toString(),
  label: node.labels[0],
  ...node.properties,
  });
  }
  });

  const nodes = Array.from(nodesMap.values()).map(node => ({
  ...node,
  isOrphan: !connectedNodeIds.has(node.id) 
 }));

  res.json({ nodes, links });

  } catch (error) {
  console.error('Error querying Neo4j:', error);
  res.status(500).json({ error: 'Failed to fetch graph data' });
  } finally {
  await session.close();
  }
});

mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});