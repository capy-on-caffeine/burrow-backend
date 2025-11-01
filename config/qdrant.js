import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

export const qdrantClient = new QdrantClient({ url: url, apiKey: apiKey });
// export const qdrantClient = new QdrantClient({ url: url, headers: { "api-key": apiKey } });

// Ensure collections exist
export async function ensureCollections() {
  try {
    // Check if collection already exists
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === "burrow_embeddings"
    );

    if (!exists) {
      // Only create if it doesn't exist
      await qdrantClient.createCollection("burrow_embeddings", {
        vectors: { size: 3072, distance: "Cosine" },
      });
      console.log("✅ Created burrow_embeddings collection");
    } else {
      console.log("✅ burrow_embeddings collection already exists");
    }
  } catch (err) {
    console.error("⚠️ Error ensuring Qdrant collection:", err.message);
    throw err;
  }
}

// Upsert vector (store embeddings)
export async function upsertVector(id, vector, metadata) {
  // Convert id to a valid format - Qdrant needs UUID string or positive integer
  const pointId = typeof id === 'string' ? id : parseInt(id, 10);
  
  await qdrantClient.upsert("burrow_embeddings", {
    points: [{ id: pointId, vector, payload: metadata }],
  });
}

// Search vectors (semantic lookup)
export async function searchVector(vector, limit = 5) {
  const res = await qdrantClient.search("burrow_embeddings", {
    vector,
    limit,
  });
  return res;
}
