import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { API_BASE_URL, apiFetch } from "../lib/api";
import { getChatSocket, type ChatConversation, type ChatMessage, type BookingRequest } from "../lib/chatSocket";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

interface Props {
  /** When set, the widget filters to a single conversation/booking. */
  conversationId?: string;
  /** When in admin mode: read-only across all conversations. */
  adminMode?: boolean;
  /** Show the booking action panel (propose/confirm/reject) for staff/CS roles. */
  showBookingActions?: boolean;
  /** Optional title override. */
  title?: string;
}

export default function ChatWidget({ conversationId: initialConvId, adminMode, showBookingActions, title }: Props) {
  const { auth, getAuthHeader } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConvId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bookingRequest, setBookingRequest] = useState<BookingRequest | null>(null);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [pendingAttach, setPendingAttach] = useState<ChatMessage["attachments"][number] | null>(null);
  const [proposeAt, setProposeAt] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const role = auth?.role;
  const myUserId = auth?.userId;
  const canSend = !adminMode && role !== "admin";
  const isStaff = role === "clinicStaff" || role === "cs" || role === "admin";

  const loadConversations = useCallback(async () => {
    try {
      const data = (await apiFetch("/chat/conversations", { headers: getAuthHeader() })) as { items: ChatConversation[] };
      const items = data.items;
      setConversations(items);
      if (!selectedId && items.length > 0) setSelectedId(items[0].id);
    } catch {
      /* ignore */
    }
  }, [getAuthHeader, selectedId]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const detail = (await apiFetch(`/chat/conversations/${id}`, { headers: getAuthHeader() })) as any;
        setBookingRequest(detail.bookingRequest ?? null);
        const msgs = (await apiFetch(`/chat/conversations/${id}/messages?limit=100`, { headers: getAuthHeader() })) as any;
        setMessages(msgs.items as ChatMessage[]);
      } catch {
        setMessages([]);
        setBookingRequest(null);
      }
    },
    [getAuthHeader]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (initialConvId) setSelectedId(initialConvId);
  }, [initialConvId]);

  useEffect(() => {
    if (selectedId) loadConversation(selectedId);
  }, [selectedId, loadConversation]);

  // Socket subscription
  useEffect(() => {
    if (!auth?.token) return;
    const socket = getChatSocket(auth.token);
    const onMessage = (payload: { conversationId: string; message: ChatMessage }) => {
      if (payload.conversationId === selectedId) {
        setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId
            ? {
                ...c,
                lastMessagePreview: payload.message.body || (payload.message.attachments[0]?.filename ?? ""),
                lastMessageAt: payload.message.createdAt,
                unreadCount:
                  payload.conversationId === selectedId || payload.message.senderId === myUserId
                    ? c.unreadCount
                    : (c.unreadCount ?? 0) + 1
              }
            : c
        )
      );
    };
    const onTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId !== selectedId) return;
      if (payload.userId === myUserId) return;
      setTypingUsers((prev) => ({ ...prev, [payload.userId]: payload.isTyping }));
      if (payload.isTyping) {
        window.setTimeout(() => {
          setTypingUsers((prev) => ({ ...prev, [payload.userId]: false }));
        }, 4000);
      }
    };
    const onConvUpdate = () => {
      loadConversations();
    };
    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);
    socket.on("conversation:update", onConvUpdate);
    socket.on("booking:confirmed", onConvUpdate);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
      socket.off("conversation:update", onConvUpdate);
      socket.off("booking:confirmed", onConvUpdate);
    };
  }, [auth?.token, selectedId, myUserId, loadConversations]);

  // Join the selected conversation room
  useEffect(() => {
    if (!auth?.token || !selectedId) return;
    const socket = getChatSocket(auth.token);
    socket.emit("conversation:join", { conversationId: selectedId });
    // Mark as read
    socket.emit("read", { conversationId: selectedId });
    apiFetch(`/chat/conversations/${selectedId}/read`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({}) }).catch(() => undefined);
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)));
    return () => {
      socket.emit("conversation:leave", { conversationId: selectedId });
    };
  }, [auth?.token, selectedId, getAuthHeader]);

  // Auto-scroll to latest
  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedId || !auth?.token) return;
    const body = draft.trim();
    if (!body && !pendingAttach) return;
    const socket = getChatSocket(auth.token);
    socket.emit(
      "message:send",
      {
        conversationId: selectedId,
        body,
        attachments: pendingAttach ? [pendingAttach] : []
      },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) {
          alert(ack?.error || "Send failed");
          return;
        }
        setDraft("");
        setPendingAttach(null);
      }
    );
  };

  const onTypingHandler = () => {
    if (!auth?.token || !selectedId) return;
    const socket = getChatSocket(auth.token);
    socket.emit("typing", { conversationId: selectedId, isTyping: true });
  };

  const uploadFile = async (file: File) => {
    if (!auth?.token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/chat/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Upload failed");
        return;
      }
      setPendingAttach(data.attachment);
    } finally {
      setUploading(false);
    }
  };

  const proposeSlot = async () => {
    if (!bookingRequest || !proposeAt) return;
    try {
      await apiFetch(`/scheduling/requests/${bookingRequest.id}/propose`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: new Date(proposeAt).toISOString() })
      });
      setProposeAt("");
      if (selectedId) loadConversation(selectedId);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmBooking = async () => {
    if (!bookingRequest) return;
    try {
      await apiFetch(`/scheduling/requests/${bookingRequest.id}/confirm`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({})
      });
      if (selectedId) loadConversation(selectedId);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const rejectBooking = async () => {
    if (!bookingRequest || !rejectReason.trim()) return;
    try {
      await apiFetch(`/scheduling/requests/${bookingRequest.id}/reject`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      setShowReject(false);
      setRejectReason("");
      if (selectedId) loadConversation(selectedId);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const acceptSlot = async () => {
    if (!bookingRequest) return;
    try {
      await apiFetch(`/scheduling/me/requests/${bookingRequest.id}/accept`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({})
      });
      if (selectedId) loadConversation(selectedId);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0), [conversations]);
  const typingNames = Object.entries(typingUsers).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="card-elevated overflow-hidden bg-white border border-surface-200" style={{ minHeight: 520 }}>
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ minHeight: 520 }}>
        {/* Conversations sidebar */}
        {!initialConvId && (
          <div className="border-r border-surface-200 bg-surface-50 max-h-[640px] overflow-y-auto">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h4 className="text-sm font-bold text-surface-900">{title ?? (ar() ? "المحادثات" : "Conversations")}</h4>
              {totalUnread > 0 && (
                <span className="text-xs font-bold bg-brand-pink-500 text-white rounded-full px-2 py-0.5">{totalUnread}</span>
              )}
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-surface-400">{ar() ? "لا توجد محادثات بعد" : "No conversations yet"}</div>
            ) : (
              <div className="divide-y divide-surface-200">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full text-left p-3 hover:bg-surface-100 transition-colors ${selectedId === c.id ? "bg-white" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-surface-900 truncate">{c.title}</div>
                      {(c.unreadCount ?? 0) > 0 && (
                        <span className="text-[10px] font-bold bg-brand-pink-500 text-white rounded-full px-1.5 py-0.5">{c.unreadCount}</span>
                      )}
                    </div>
                    <div className="text-xs text-surface-500 truncate mt-0.5">{c.lastMessagePreview || "—"}</div>
                    <div className="text-[10px] text-surface-400 mt-1">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message thread */}
        <div className={`${initialConvId ? "md:col-span-3" : "md:col-span-2"} flex flex-col`}>
          {selectedId ? (
            <>
              {bookingRequest && (
                <div className="border-b border-surface-200 bg-gradient-to-r from-brand-pink-50 to-white p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
                        {ar() ? "حجز" : "Booking"}
                      </div>
                      <div className="font-bold text-surface-900 text-sm">
                        {ar() ? "حالة" : "Status"}:{" "}
                        <span className="badge-pink">{bookingRequest.status.replace("_", " ")}</span>
                      </div>
                      {bookingRequest.proposedAt && (
                        <div className="text-xs text-surface-600 mt-1">
                          {ar() ? "وقت مقترح" : "Proposed"}: {new Date(bookingRequest.proposedAt).toLocaleString()}
                        </div>
                      )}
                      {bookingRequest.preferredAt && !bookingRequest.proposedAt && (
                        <div className="text-xs text-surface-600 mt-1">
                          {ar() ? "وقت مفضل" : "Preferred"}: {new Date(bookingRequest.preferredAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Customer accept slot */}
                    {!adminMode && role === "customer" && bookingRequest.status === "slot_proposed" && (
                      <button className="btn-primary btn-sm" onClick={acceptSlot}>
                        {ar() ? "قبول الموعد" : "Accept Slot"}
                      </button>
                    )}

                    {/* Staff propose / confirm / reject */}
                    {!adminMode && showBookingActions && isStaff && !["confirmed", "cancelled", "rejected"].includes(bookingRequest.status) && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          className="input-field text-sm"
                          value={proposeAt}
                          onChange={(e) => setProposeAt(e.target.value)}
                        />
                        <button className="btn-secondary btn-sm" onClick={proposeSlot} disabled={!proposeAt}>
                          {ar() ? "اقتراح وقت" : "Propose"}
                        </button>
                        <button className="btn-primary btn-sm bg-emerald-500 hover:bg-emerald-600" onClick={confirmBooking}>
                          {ar() ? "تأكيد" : "Confirm"}
                        </button>
                        <button
                          className="btn-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3 py-1.5 text-xs font-bold"
                          onClick={() => setShowReject((s) => !s)}
                        >
                          {ar() ? "رفض" : "Reject"}
                        </button>
                      </div>
                    )}
                  </div>
                  {showReject && (
                    <div className="mt-3 flex gap-2">
                      <input
                        className="input-field text-sm flex-1"
                        placeholder={ar() ? "سبب الرفض" : "Rejection reason"}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button className="btn-primary btn-sm bg-red-500 hover:bg-red-600" onClick={rejectBooking}>
                        {ar() ? "تأكيد الرفض" : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px] bg-surface-50/30">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-surface-400 py-12">
                    {ar() ? "لا توجد رسائل بعد" : "No messages yet"}
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === myUserId;
                  const isSystem = !!m.systemKind;
                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center">
                        <span className="text-[11px] bg-surface-200 text-surface-700 rounded-full px-3 py-1 font-medium">
                          {m.body}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                          mine ? "bg-brand-pink-500 text-white" : "bg-white border border-surface-200 text-surface-900"
                        }`}
                      >
                        <div className={`text-[10px] font-bold mb-0.5 ${mine ? "text-brand-pink-100" : "text-surface-500"}`}>
                          {m.senderRole} · {m.senderId.slice(0, 10)}
                        </div>
                        {m.body && <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>}
                        {m.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={`${API_BASE_URL}${a.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`block mt-2 text-xs underline ${mine ? "text-white" : "text-brand-pink-600"}`}
                          >
                            {a.mimeType.startsWith("image/") ? (
                              <img
                                src={`${API_BASE_URL}${a.url}`}
                                alt={a.filename}
                                className="max-h-48 rounded-lg"
                              />
                            ) : (
                              <>📎 {a.filename}</>
                            )}
                          </a>
                        ))}
                        <div className={`text-[10px] mt-1 ${mine ? "text-brand-pink-100" : "text-surface-400"}`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typingNames.length > 0 && (
                  <div className="text-xs text-surface-500 italic">{ar() ? "يكتب..." : "Typing..."}</div>
                )}
              </div>

              {canSend && (
                <div className="border-t border-surface-200 p-3 bg-white">
                  {pendingAttach && (
                    <div className="text-xs text-surface-600 mb-2 flex items-center gap-2">
                      📎 {pendingAttach.filename}
                      <button className="text-red-500" onClick={() => setPendingAttach(null)}>
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-surface-500 hover:text-brand-pink-500 px-2">
                      📎
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf,text/plain"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <input
                      className="input-field flex-1 text-sm"
                      placeholder={ar() ? "اكتب رسالة..." : "Type a message..."}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        onTypingHandler();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={uploading}
                    />
                    <button className="btn-primary btn-sm" onClick={sendMessage} disabled={uploading || (!draft.trim() && !pendingAttach)}>
                      {ar() ? "إرسال" : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-surface-400">
              {ar() ? "اختر محادثة" : "Select a conversation"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
