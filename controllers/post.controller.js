import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const POSTS_TABLE = process.env.POSTS_TABLE || "Posts";

/**
 * Get all posts (sorted by createdAt descending)
 */
export const getAllPosts = async (req, res) => {
  try {
    console.log("Fetching all posts");
    const data = await docClient.send(new ScanCommand({ TableName: POSTS_TABLE }));
    const posts = data.Items || [];
    // sort manually since DynamoDB doesn't support sort without index
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error: error.message });
  }
};

/**
 * Get posts by subreddit (using a GSI or filtering)
 */
export const getPostsBySubreddit = async (req, res) => {
  try {
    const { subreddit } = req.params;
    const decodedSubreddit = decodeURIComponent(subreddit);

    // If you have a GSI named "SubredditIndex" with PK=subreddit
    const params = {
      TableName: POSTS_TABLE,
      IndexName: "SubredditIndex", // Optional if you have GSI
      KeyConditionExpression: "subreddit = :s",
      ExpressionAttributeValues: { ":s": decodedSubreddit },
    };

    let posts;
    try {
      const result = await docClient.send(new QueryCommand(params));
      posts = result.Items || [];
    } catch {
      // fallback to scan + filter if no GSI
      const result = await docClient.send(new ScanCommand({
        TableName: POSTS_TABLE,
        FilterExpression: "subreddit = :s",
        ExpressionAttributeValues: { ":s": decodedSubreddit },
      }));
      posts = result.Items || [];
    }

    if (!posts.length) {
      return res.status(404).json({ message: "No posts found for this subreddit" });
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts by subreddit", error: error.message });
  }
};

/**
 * Get posts by title
 */
export const getPostsByTitle = async (req, res) => {
  try {
    const { title } = req.params;
    const decodedTitle = decodeURIComponent(title);

    const result = await docClient.send(new ScanCommand({
      TableName: POSTS_TABLE,
      FilterExpression: "title = :t",
      ExpressionAttributeValues: { ":t": decodedTitle },
    }));

    const posts = result.Items || [];

    if (!posts.length) {
      return res.status(404).json({ message: "No posts found for this title" });
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts by title", error: error.message });
  }
};

/**
 * Create a new post
 */
export const createPost = async (req, res) => {
  try {
    const { title, body, author, subreddit } = req.body;

    if (!title || !author || !subreddit) {
      return res.status(400).json({ message: "Title, Author, and Subreddit are required." });
    }

    const post = {
      id: crypto.randomUUID(),
      title,
      body,
      author,
      subreddit,
      votes: 0,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: POSTS_TABLE,
      Item: post,
    }));

    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ message: "Error creating post", error: error.message });
  }
};

/**
 * Get post by ID
 */
export const getPostById = async (req, res) => {
  try {
    console.log("Fetching post by ID");
    const { id } = req.params;
    const result = await docClient.send(new GetCommand({
      TableName: POSTS_TABLE,
      Key: { id },
    }));

    if (!result.Item) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json(result.Item);
  } catch (error) {
    res.status(500).json({ message: "Error fetching post", error: error.message });
  }
};

/**
 * Update post votes (up/down)
 */
export const updatePostVotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;

    const increment = voteType === "up" ? 1 : voteType === "down" ? -1 : null;
    if (increment === null) {
      return res.status(400).json({ message: "Invalid vote type. Must be 'up' or 'down'." });
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: POSTS_TABLE,
      Key: { id },
      UpdateExpression: "SET votes = if_not_exists(votes, :zero) + :inc",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": increment,
      },
      ReturnValues: "ALL_NEW",
    }));

    res.status(200).json(result.Attributes);
  } catch (error) {
    res.status(400).json({ message: "Error updating votes", error: error.message });
  }
};
