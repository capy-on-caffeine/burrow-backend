import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();



// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ddb = DynamoDBDocumentClient.from(client);

// DynamoDB table name
const USERS_TABLE = "Users";

// 🧩 Register
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ✅ Check if email already exists
    const checkUser = await ddb.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index", // created in your DynamoDB table
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
    );

    if (checkUser.Items && checkUser.Items.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ✅ Hash password and save new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      userId: uuidv4(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: newUser,
      })
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("❌ Register Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧩 Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Find user by email
    const result = await ddb.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.Items[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.userId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export default { register, login };
