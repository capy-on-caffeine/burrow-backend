import cosineSimilarity from "cosine-similarity";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// --- In-memory stores
let topics = {};
let keywords = {};
let relations = [];
const tags = {};   // { id, name, vector, connections: Set<tagId> }
const posts = {};  // { id, title, content, vector, tagIds: [] }
let _loaded = false;

export async function embed(text) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
  })
  return response.embeddings[0].values;
}

const load = async () => {
  const DATA_PATH = path.join(process.cwd(), "wiki_feed_graph.json");

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const data = JSON.parse(raw);

    console.log("📄 Raw data loaded from wiki_feed_graph.json");

    // Convert keywords array into a map (await embeddings)
    if (Array.isArray(data.keywords)) {
      keywords = {};
      for (const k of data.keywords) {
        const keyName = k.name || uuidv4();
        const id = uuidv4();
        const vector = await embed(k.name || "");
        keywords[keyName] = { id, name: k.name, vector, connections: new Set() };
      }
    }

    // Convert topics array into a map (await embeddings)
    if (Array.isArray(data.topics)) {
      topics = {};
      for (const t of data.topics) {
        const key = t.title || uuidv4();
        const id = uuidv4();
        const vector = await embed(`${t.title || ""} ${t.summary || ""}`);
        topics[key] = {
          id,
          title: t.title || "untitled",
          summary: t.summary || "",
          keywords: t.keywords || [],
          vector,
        };
      }
    }

    // Load tags (if present) and await embeddings; ensure connections are Sets
    if (Array.isArray(data.tags)) {
      for (const t of data.tags) {
        const id = t.id || uuidv4();
        const name = t.name || "";
        const vector = Array.isArray(t.vector) && t.vector.length ? t.vector : await embed(name);
        const connections = new Set(Array.isArray(t.connections) ? t.connections : []);
        tags[id] = { id, name, vector, connections };
      }
    }

    // Load posts (if present) and await embeddings; resolve tag references by id or name
    const findTagId = (ref) => {
      if (!ref) return null;
      if (tags[ref]) return ref; // already an id
      // try to find by name
      for (const tId of Object.keys(tags)) {
        if (String(tags[tId].name).toLowerCase() === String(ref).toLowerCase()) return tId;
      }
      return null;
    };

    if (Array.isArray(data.posts)) {
      for (const p of data.posts) {
        const id = p.id || uuidv4();
        const title = p.title || "";
        const content = p.content || "";
        const vector = Array.isArray(p.vector) && p.vector.length ? p.vector : await embed(`${title} ${content}`);
        const rawTagRefs = p.tagIds || p.tags || [];
        const tagIds = [];
        for (const ref of rawTagRefs) {
          const resolved = findTagId(ref) || null;
          if (resolved) tagIds.push(resolved);
        }
        posts[id] = { id, title, content, vector, tagIds };
      }
    }

    // Store relations as-is, but validate format
    if (Array.isArray(data.relations)) {
      relations = data.relations
        .filter((r) => r.from && r.to && r.type)
        .map((r) => ({
          id: uuidv4(),
          from: r.from,
          to: r.to,
          type: r.type,
        }));

      // Optionally link keywords/topics/tags using the relations
      relations.forEach((r) => {
        if (r.type === "TAGGED_WITH") {
          // r.to may be a keyword or tag id/name — attempt to add connection
          // If keywords keyed by name contain the key, add connection by id
          if (keywords[r.to]) {
            if (!keywords[r.to].connections) keywords[r.to].connections = new Set();
            keywords[r.to].connections.add(r.from);
          }
          // If r.to is a tag id and tag exists, add connection
          if (tags[r.to]) {
            tags[r.to].connections.add(r.from);
          }
        }
      });
    }

    _loaded = true;

    console.log(
      `✅ Loaded ${Object.keys(topics).length} topics, ${Object.keys(
        keywords
      ).length} keywords, and ${relations.length} relations from wiki_feed_graph.json`
    );
  } catch (err) {
    console.error("⚠️ Could not load wiki_feed_graph.json:", err.message);
  }
};

// await embed("What is the meaning of life?");

// --- Mock embedder (replace with real model later)
// function embed(text) {
//   const arr = Array.from(text).map(ch => (ch.charCodeAt(0) % 10) / 10);
//   const norm = Math.sqrt(arr.reduce((a, b) => a + b * b, 0)) || 1;
//   return arr.map(x => x / norm);
// }

function createTag(name, vector) {
  const id = uuidv4();
  tags[id] = { id, name, vector, connections: new Set() };
  return tags[id];
}

function connectTags(id1, id2) {
  if (id1 === id2) return;
  tags[id1]?.connections.add(id2);
  tags[id2]?.connections.add(id1);
}

// --- Add post and attach to tags
export async function addPost(title, content) {
  await load();
  const postVector = await embed(`${title} ${content}`);
  const postId = uuidv4();

  const sims = Object.values(tags).map(tag => ({
    tag,
    sim: cosineSimilarity(postVector, tag.vector)
  }));

  const attachThreshold = 0.85;
  const topTags = sims
    .filter(s => s.sim > attachThreshold)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5)
    .map(s => s.tag);

  // Create new tag if none match
  if (topTags.length === 0) {
    const newTag = createTag(title.toLowerCase(), postVector);
    topTags.push(newTag);
  }

  posts[postId] = {
    id: postId,
    title,
    content,
    vector: postVector,
    tagIds: topTags.map(t => t.id)
  };

  // Interconnect tags
  for (let i = 0; i < topTags.length; i++) {
    for (let j = i + 1; j < topTags.length; j++) {
      connectTags(topTags[i].id, topTags[j].id);
    }
  }

  return posts[postId];
}

// --- Search
export async function searchPosts(query) {
  await load();

  const qVec = await embed(query);
  const tagScores = Object.values(tags).map(tag => ({
    tag,
    sim: cosineSimilarity(qVec, tag.vector)
  }));

  const topTags = tagScores
    .filter(s => s.sim > 0.8)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5)
    .map(s => s.tag);

  const topTagIds = new Set(topTags.map(t => t.id));
  const relatedPosts = Object.values(posts).filter(p =>
    p.tagIds.some(id => topTagIds.has(id))
  );

  return { tags: topTags, posts: relatedPosts };
}