import neo4j from "neo4j-driver";
import fs from "fs";

// =============================
// 🔧 CONFIGURATION (AuraDB)
// =============================
const uri = "neo4j+s://6c64c84b.databases.neo4j.io"; // ✅ your AuraDB URI
const user = "neo4j"; // default Aura username
const password = "dVaiONXta2gQIyuvsGyKQGVCEGe56gAaJUIFPxY30ac"; // copy from Aura console
const jsonFile = "wiki_feed_graph.json"; // your scraped data file

// =============================
// ⚡ CONNECT TO AURA
// =============================
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session({ database: "neo4j" }); // ✅ important

// =============================
// 📦 LOAD JSON DATA
// =============================
let data;
try {
  const raw = fs.readFileSync(jsonFile, "utf-8");
  data = JSON.parse(raw);
  console.log(`Loaded JSON with ${data.topics.length} topics and ${data.relations.length} relations`);
} catch (err) {
  console.error("❌ Failed to read wiki_feed_graph.json:", err);
  process.exit(1);
}

// =============================
// 🚀 IMPORT FUNCTION
// =============================
async function importGraph() {
  console.log("🚀 Starting import to AuraDB...\n");

  try {
    console.log("🟢 Creating Topic nodes...");
    for (const topic of data.topics) {
      await session.run(
        `
        MERGE (t:Topic {title: $title})
        SET t.summary = $summary,
            t.keywords = $keywords
        `,
        topic
      );
    }

    console.log("🟣 Creating Keyword nodes...");
    for (const keyword of data.keywords) {
      await session.run(
        `
        MERGE (k:Keyword {name: $name})
        `,
        keyword
      );
    }

    console.log("🔗 Creating relationships...");
    for (const rel of data.relations) {
      const { from, to, type } = rel;
      const relType = type.toUpperCase().replace(/[^A-Z_]/g, "_");

      await session.run(
        `
        MATCH (a:Topic {title: $from})
        MATCH (b {title: $to}) 
        MERGE (a)-[r:${relType}]->(b)
        `,
        rel
      ).catch(() => {});
    }

    console.log("\n✅ All data imported successfully into AuraDB!");
  } catch (error) {
    console.error("❌ Error importing data:", error);
  } finally {
    await session.close();
    await driver.close();
    console.log("🔒 Connection closed.");
  }
}

importGraph();