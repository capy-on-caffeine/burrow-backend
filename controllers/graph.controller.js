import dotenv from 'dotenv';
dotenv.config();

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

export const getGraphData = async (req, res) => {
  const session = driver.session();

  // Based on your screenshot, you are interested in ACTED_IN
  // This query gets nodes (n, m) and the relationship (r) between them.
  const query = `
    MATCH (n)-[r:ACTED_IN]->(m) 
    RETURN n, r, m 
    LIMIT 30
  `;

  try {
    const result = await session.run(query);

    // 4. --- THIS IS THE CRITICAL TRANSFORMATION ---
    // We must convert the Neo4j data into a format
    // that react-force-graph understands: { nodes: [], links: [] }

    const nodesMap = new Map();
    const links = [];

    result.records.forEach(record => {
      const node1 = record.get('n');
      const node2 = record.get('m');
      const rel = record.get('r');

      // Add nodes to the map (handles duplicates automatically)
      // We use the Neo4j internal ID as the 'id' for the graph library
      if (!nodesMap.has(node1.identity)) {
        nodesMap.set(node1.identity, {
          id: node1.identity,
          label: node1.labels[0], // e.g., "Person"
          ...node1.properties,    // e.g., { name: "Al Pacino", born: 1940 }
        });
      }
      if (!nodesMap.has(node2.identity)) {
        nodesMap.set(node2.identity, {
          id: node2.identity,
          label: node2.labels[0], // e.g., "Movie"
          ...node2.properties,    // e.g., { title: "The Godfather" }
        });
      }

      // Add the link
      // 'source' and 'target' must match the 'id' of the nodes
      links.push({
        source: rel.start, // Neo4j internal ID for the start node
        target: rel.end,   // Neo4j internal ID for the end node
        label: rel.type,
      });
    });

    const nodes = Array.from(nodesMap.values());
    console.log('Transformed graph data:', { nodes, links });
    res.json({ nodes, links });
    // ------------------------------------------------

  } catch (error) {
    console.error('Error querying Neo4j:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  } finally {
    await session.close();
  }
};
