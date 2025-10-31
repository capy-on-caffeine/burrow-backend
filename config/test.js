import driver from "./neo4j.js";

async function testConnection() {
  try {
    const session = driver.session();
    const result = await session.run("RETURN 'Neo4j connected!' AS message");
    console.log(result.records[0].get("message"));
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await driver.close();
  }
}

testConnection();
