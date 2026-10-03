import type { Server as IOServer } from "socket.io";
import mongoose from "mongoose";
import { createAdapter } from "@socket.io/mongo-adapter";

const COLLECTION = "socket_io_events";

/**
 * With more than one server instance, relay Socket.IO events between them through MongoDB
 * (change streams; Atlas supports them), so a message sent on one instance reaches browsers
 * connected to another. Off unless CHAT_SOCKET_ADAPTER=mongo — a single instance doesn't need it.
 */
export function useMongoAdapter(io: IOServer) {
  const collection = mongoose.connection.db!.collection(COLLECTION);
  // Relay events are only needed for a moment; let MongoDB delete them after an hour.
  collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }).catch(() => {});
  io.adapter(createAdapter(collection, { addCreatedAtField: true }));
}
