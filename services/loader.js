import { getAllTags, getAllPosts, getAllTagsWithIds, getAllPostsWithIds } from "../config/neo4j.js";
import { embed } from "../controllers/search.controller.js";
import { upsertVector } from "../config/qdrant.js";

export async function syncDataToQdrant() {
  const tags = await getAllTagsWithIds();
  const posts = await getAllPostsWithIds();

  console.log(tags);
  console.log(posts);

  for (const tag of tags) {
    const vector = await embed(tag.name);
    await upsertVector(tag.id, vector, { type: "tag", name: tag.name });
  }

  for (const post of posts) {
    const vector = await embed(`${post.title} ${post.content}`);
    await upsertVector(post.id, vector, { type: "post", title: post.title });
  }

  console.log(`✅ Synced ${tags.length} tags & ${posts.length} posts to Qdrant`);
}
