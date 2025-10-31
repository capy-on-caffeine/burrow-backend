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

export default driver;
