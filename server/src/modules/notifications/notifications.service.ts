import { notificationsStore } from "./notifications.store.js";

export function notifyKycSubmitted(userId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "kyc_submitted",
    title: "KYC submitted",
    body: "Your verification is under review. We aim to respond within 4 business hours."
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "kyc_submitted", payload: {} });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "kyc_submitted", payload: {} });
}

export function notifyKycApproved(userId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "kyc_approved",
    title: "KYC approved",
    body: "Your account is verified. Your 500 KWD locked wallet has been initialized."
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "kyc_approved", payload: {} });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "kyc_approved", payload: {} });
}

export function notifyKycRejected(userId: string, reason: string) {
  notificationsStore.pushInApp({
    userId,
    type: "kyc_rejected",
    title: "KYC rejected",
    body: `Reason: ${reason}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "kyc_rejected", payload: { reason } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "kyc_rejected", payload: { reason } });
}

export function notifyOfferPendingPayment(userId: string, userOfferId: string, amountKwd: string) {
  notificationsStore.pushInApp({
    userId,
    type: "offer_pending_payment",
    title: "Payment pending",
    body: `Your offer is on hold for 48 hours. Amount due: ${amountKwd} KWD. Reference: ${userOfferId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "offer_pending_payment", payload: { userOfferId, amountKwd } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "offer_pending_payment", payload: { userOfferId, amountKwd } });
}

export function notifyPaymentConfirmed(userId: string, userOfferId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "payment_confirmed",
    title: "Payment confirmed",
    body: `Your offer is active. Reference: ${userOfferId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "payment_confirmed", payload: { userOfferId } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "payment_confirmed", payload: { userOfferId } });
}

export function notifyBookingConfirmed(userId: string, sessionId: string, scheduledAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "booking_confirmed",
    title: "Booking confirmed",
    body: `Your appointment is confirmed for ${scheduledAtIso}. Session: ${sessionId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "booking_confirmed", payload: { sessionId, scheduledAtIso } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "booking_confirmed", payload: { sessionId, scheduledAtIso } });
}

export function notifySessionCompletedCashback(userId: string, sessionId: string, unlockedKwd: string) {
  notificationsStore.pushInApp({
    userId,
    type: "session_completed_cashback",
    title: "Session completed",
    body: `Cashback unlocked: ${unlockedKwd} KWD. Session: ${sessionId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "session_completed_cashback", payload: { sessionId, unlockedKwd } });
}

