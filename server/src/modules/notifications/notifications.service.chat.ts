import { notificationsStore, type NotificationRecord } from "./notifications.store.js";

type ChatNotifKind = Extract<
  NotificationRecord["type"],
  | "chat_message"
  | "booking_under_review"
  | "booking_slot_proposed"
  | "booking_slot_accepted"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
>;

const titleByKind: Record<ChatNotifKind, string> = {
  chat_message: "New message",
  booking_under_review: "Booking received",
  booking_slot_proposed: "New time proposed",
  booking_slot_accepted: "Customer accepted slot",
  booking_confirmed: "Booking confirmed",
  booking_rejected: "Booking rejected",
  booking_cancelled: "Booking cancelled"
};

export function notifyChatRelatedUsers(input: {
  userIds: string[];
  kind: ChatNotifKind;
  body: string;
  payload?: Record<string, unknown>;
}) {
  for (const uid of input.userIds) {
    notificationsStore.pushInApp({
      userId: uid,
      type: input.kind,
      title: titleByKind[input.kind],
      body: input.body
    });

    if (input.kind !== "chat_message") {
      notificationsStore.pushOutbound({
        userId: uid,
        channel: "email",
        template: input.kind,
        payload: input.payload ?? {}
      });
    }

    // eslint-disable-next-line no-console
    console.log(`[notify:${input.kind}] -> ${uid} :: ${input.body}`);
  }
}
