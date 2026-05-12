import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "../config/env.js";

export async function connectMongo(): Promise<void> {
  if (!env.MONGODB_URI) {
    throw new Error("connectMongo called without MONGODB_URI");
  }
  // Some local Windows/network setups refuse SRV DNS queries intermittently.
  // Pin resolvers for predictable Atlas SRV resolution in dev.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    dbName: "test",
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000
  });
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

