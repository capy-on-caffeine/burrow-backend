import dotenv from "dotenv";
import neo4j from "neo4j-driver";

dotenv.config();

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

console.log("🔍 NEO4J_URI:", uri); // Debug line

if (!uri || !user || !password) {
  console.error("❌ Missing one or more Neo4j environment variables");
  process.exit(1);
}

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export const session = () => driver.session();

export async function getAllTags() {
  const s = session();
  const res = await s.run(`MATCH (t:Tag) RETURN t`);
  await s.close();
  return res.records.map(r => r.get("t").properties);
}

export async function getAllTagsWithIds() {
  const s = session();
  const res = await s.run(`MATCH (t:Tag) RETURN id(t) as id, t.name as name`);
  await s.close();
  return res.records.map(r => ({
    id: r.get("id").toInt(), // Convert Neo4j Integer to JavaScript number
    name: r.get("name")
  }));
}

export async function getAllPosts() {
  const s = session();
  const res = await s.run(`MATCH (p:Post) RETURN p`);
  await s.close();
  return res.records.map(r => r.get("p").properties);
}

export async function getAllPostsWithIds() {
  const s = session();
  const res = await s.run(`MATCH (p:Post) RETURN id(p) as id, p.title as title, p.content as content`);
  await s.close();
  return res.records.map(r => ({
    id: r.get("id").toInt(), // Convert Neo4j Integer to JavaScript number
    title: r.get("title"),
    content: r.get("content") || ""
  }));
}

export async function createPostNode({ id, title, content, tagIds }) {
  const s = session();
  await s.run(
    `
    CREATE (p:Post {id: $id, title: $title, content: $content, createdAt: datetime()})
    WITH p
    UNWIND $tagIds AS tagId
    MATCH (t:Tag {id: tagId})
    MERGE (p)-[:MENTIONS]->(t)
    RETURN p
    `,
    { id, title, content, tagIds }
  );
  await s.close();
}

export default driver;
