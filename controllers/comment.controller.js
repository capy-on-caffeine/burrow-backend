import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ddb = DynamoDBDocumentClient.from(client);
const COMMENTS_TABLE = "Comments";

// ✅ Get all comments for a specific post
export const getCommentsForPost = async (req, res) => {
  try {
    console.log("Fetching comments for post:", req.params.postId);
    const { postId } = req.params;

    const result = await ddb.send(
      new QueryCommand({
        TableName: COMMENTS_TABLE,
        IndexName: "postId-index",
        KeyConditionExpression: "postId = :postId",
        ExpressionAttributeValues: {
          ":postId": postId,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ message: "No comments found for this post" });
    }

    res.status(200).json(result.Items);
  } catch (error) {
    console.error("❌ Error fetching comments:", error);
    res.status(500).json({ message: "Error fetching comments", error: error.message });
  }
};

// ✅ Update a comment's vote
export const updateCommentVote = async (req, res) => {
  try {
    console.log("Updating comment vote:", req.params.id);
    const { id } = req.params;
    const { direction } = req.body;

    let voteChange = 0;
    if (direction === "up") voteChange = 1;
    else if (direction === "down") voteChange = -1;
    else return res.status(400).json({ message: "Invalid vote direction" });

    const result = await ddb.send(
      new UpdateCommand({
        TableName: COMMENTS_TABLE,
        Key: { commentId: id },
        UpdateExpression: "ADD votes :inc SET updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":inc": voteChange,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    if (!result.Attributes) {
      return res.status(404).json({ message: "Comment not found" });
    }

    res.status(200).json(result.Attributes);
  } catch (error) {
    console.error("❌ Error updating vote:", error);
    res.status(500).json({ message: "Error updating vote", error: error.message });
  }
};

// ✅ Update comment text
export const updateCommentText = async (req, res) => {
  try {
    console.log("Updating comment text:", req.params.id);
    const { id } = req.params;
    const { commentText } = req.body;

    if (!commentText || commentText.trim() === "") {
      return res.status(400).json({ message: "Comment text cannot be empty" });
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: COMMENTS_TABLE,
        Key: { commentId: id },
        UpdateExpression:
          "SET commentText = :commentText, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":commentText": commentText,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    if (!result.Attributes) {
      return res.status(404).json({ message: "Comment not found" });
    }

    res.status(200).json(result.Attributes);
  } catch (error) {
    console.error("❌ Error updating comment:", error);
    res.status(500).json({ message: "Error updating comment", error: error.message });
  }
};

// ✅ Delete comment (and recursively delete children)
export const deleteComment = async (req, res) => {
  try {
    console.log("Deleting comment and its replies:", req.params.id);
    const { id } = req.params;

    // Recursive deletion helper
    const deleteChildren = async (parentId) => {
      const children = await ddb.send(
        new ScanCommand({
          TableName: COMMENTS_TABLE,
          FilterExpression: "parentCommentId = :parentId",
          ExpressionAttributeValues: {
            ":parentId": parentId,
          },
        })
      );

      for (const child of children.Items || []) {
        await deleteChildren(child.commentId);
        await ddb.send(
          new DeleteCommand({
            TableName: COMMENTS_TABLE,
            Key: { commentId: child.commentId },
          })
        );
      }
    };

    await deleteChildren(id);

    // Delete parent comment itself
    await ddb.send(
      new DeleteCommand({
        TableName: COMMENTS_TABLE,
        Key: { commentId: id },
      })
    );

    res.status(200).json({ message: "Comment and all replies deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting comment:", error);
    res.status(500).json({ message: "Error deleting comment", error: error.message });
  }
};
