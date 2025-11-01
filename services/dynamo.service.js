import dynamoDB from '../config/dynamodb.js';

// Generic helper to put item
export const putItem = async (TableName, Item) => {
  const params = { TableName, Item };
  await dynamoDB.put(params).promise();
  return Item;
};

// Get item by key
export const getItem = async (TableName, Key) => {
  const params = { TableName, Key };
  const result = await dynamoDB.get(params).promise();
  return result.Item;
};

// Query items (for secondary indexes or attributes)
export const queryItems = async (params) => {
  const result = await dynamoDB.query(params).promise();
  return result.Items;
};

// Scan table (use carefully)
export const scanItems = async (TableName) => {
  const params = { TableName };
  const result = await dynamoDB.scan(params).promise();
  return result.Items;
};
