import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo(): Promise<void> {
  if (!env.MONGODB_URI) {
    throw new Error("connectMongo called without MONGODB_URI");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000
  });
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

