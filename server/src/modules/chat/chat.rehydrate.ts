/**
 * Shared rehydration helper for chat conversations.
 * Extracted to avoid circular dependencies between chat.router and chat.socket.
 */
import { chatStore } from "./chat.store.js";
import { bookingRequestsStore } from "../scheduling/bookingRequests.store.js";
import { ensureConversationFor } from "../scheduling/scheduling.router.js";

/**
 * Resolve a conversation by ID: first checks the in-memory chatStore,
 * then falls back to finding the associated booking request and re-creating
 * the conversation (rehydration after server restart).
 */
export async function ensureConversationById(id: string) {
  let conv = chatStore.getConversation(id);
  if (conv) return conv;
  const breq = await bookingRequestsStore.findByConversationId(id);
  if (breq) {
    const res = await ensureConversationFor(breq.id);
    return res.conv;
  }
  return null;
}
