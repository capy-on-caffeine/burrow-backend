import { embed } from "../controllers/search.controller.js";
import { createPostNode, getAllTags } from "../config/neo4j.js";
import { upsertVector, searchVector } from "../config/qdrant.js";
import { v4 as uuidv4 } from "uuid";
// import cosineSimilarity from "cosine-similarity";

export async function addPost({ title, content }) {
  const id = uuidv4();
  const vector = await embed(`${title} ${content}`);

  // Find related tags from Qdrant
  const tagResults = await searchVector(vector, 5);
  const tagIds = tagResults
    .filter(r => r.payload?.type === "tag" && r.score > 0.8)
    .map(r => r.payload.id);

  await createPostNode({ id, title, content, tagIds });
  await upsertVector(id, vector, { type: "post", title });

  return { id, title, content, tagIds };
}
