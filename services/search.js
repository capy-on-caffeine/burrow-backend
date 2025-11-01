import { embed } from "../controllers/search.controller.js";
import { searchVector } from "../config/qdrant.js";
import { session } from "../config/neo4j.js";
import { fetchPostsByTitles } from "../controllers/post.controller.js";

export async function searchBurrow(query) {
  const qVec = await embed(query);
  const results = await searchVector(qVec, 8);

  // Get matching tag/post metadata
  const s = session();
  const ids = results.map(r => r.payload.id || r.id);
  const res = await s.run(
    `
    MATCH (n)
    WHERE id(n) IN $ids
    RETURN n
    `,
    { ids }
  );
  await s.close();
  
  const nodes = res.records.map(r => r.get("n").properties);
  console.log(nodes);
  console.log(results);
  
  let titleList = [];

  for (const r of results) {
    titleList.push(r.payload.name);
  }

  const postsByTitles = await fetchPostsByTitles(titleList);
  
  return postsByTitles
}
