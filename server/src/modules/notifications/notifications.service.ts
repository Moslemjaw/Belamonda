import { notificationsStore } from "./notifications.store.js";

// ── KYC ───────────────────────────────────────────────────────────────────

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

// ── Offer / Commerce ──────────────────────────────────────────────────────

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

// ── Payment lifecycle ─────────────────────────────────────────────────────

export function notifyPaymentSuccess(userId: string, userOfferId: string, amountKwd: string) {
  notificationsStore.pushInApp({
    userId,
    type: "payment_success",
    title: "Payment successful",
    body: `We received ${amountKwd} KWD. Reference: ${userOfferId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "payment_success", payload: { userOfferId, amountKwd } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "payment_success", payload: { userOfferId, amountKwd } });
}

export function notifyPaymentFailed(userId: string, userOfferId: string, reason: string) {
  notificationsStore.pushInApp({
    userId,
    type: "payment_failed",
    title: "Payment failed",
    body: `Your payment did not go through. Reason: ${reason}. Please try again or use a different method.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "payment_failed", payload: { userOfferId, reason } });
}

export function notifyInstallmentPaid(userId: string, userOfferId: string, n: number, total: number) {
  notificationsStore.pushInApp({
    userId,
    type: "installment_paid",
    title: `Installment ${n} of ${total} paid`,
    body: n >= total
      ? `You're fully paid up. Enjoy the rest of your sessions!`
      : `Thanks! ${total - n} installment${total - n === 1 ? "" : "s"} remain.`
  });
}

export function notifyInstallmentDue(userId: string, userOfferId: string, n: number, total: number, dueAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "installment_due",
    title: `Installment ${n} of ${total} due soon`,
    body: `Your next installment is due on ${new Date(dueAtIso).toLocaleDateString()}.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "installment_due", payload: { userOfferId, n, total, dueAtIso } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "installment_due", payload: { userOfferId, n, total, dueAtIso } });
}

export function notifyDepositReserved(userId: string, userOfferId: string, expiresAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "deposit_reserved",
    title: "Deposit received — offer reserved",
    body: `Your spot is held until ${new Date(expiresAtIso).toLocaleDateString()}. Complete the balance any time before then.`
  });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "deposit_reserved", payload: { userOfferId, expiresAtIso } });
}

export function notifyDepositExpiring(userId: string, userOfferId: string, expiresAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "deposit_expiring",
    title: "Reservation expiring soon",
    body: `Your deposit reservation expires on ${new Date(expiresAtIso).toLocaleDateString()}. Complete the balance to keep your spot.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "deposit_expiring", payload: { userOfferId, expiresAtIso } });
}

export function notifyDepositExpired(userId: string, userOfferId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "deposit_expired",
    title: "Reservation expired",
    body: `Your deposit reservation has expired. Please re-reserve to continue.`
  });
}

export function notifyEnetApproved(userId: string, userOfferId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "enet_approved",
    title: "ENET approved",
    body: `Your 4-installment plan is approved and your offer is now active.`
  });
}

export function notifyEnetRejected(userId: string, userOfferId: string, reason: string) {
  notificationsStore.pushInApp({
    userId,
    type: "enet_rejected",
    title: "ENET declined",
    body: `Your 4-installment request was declined (${reason}). You can try a 2 or 3-installment plan or pay in full.`
  });
}

// ── Forms ─────────────────────────────────────────────────────────────────

export function notifyFormSignatureRequired(userId: string, formId: string, formTitle: string) {
  if (!notificationsStore.hasUnreadFormSignature(userId, formId)) {
    notificationsStore.pushInApp({
      userId,
      type: "form_signature_required",
      title: "Form to sign",
      body: `Please sign the form "${formTitle}" to keep your offer active.`,
      actionUrl: `/forms/fill/${formId}?return=/dashboard`
    });
  }
  notificationsStore.pushOutbound({ userId, channel: "email", template: "form_signature_required", payload: { formId, formTitle } });
}

/** SMS-only reminder for an unsigned form. Used by the background reminder job;
 *  does NOT push an in-app notification to avoid inbox duplicates. */
export function notifyFormSignatureReminderSms(userId: string, formId: string, formTitle: string) {
  notificationsStore.pushOutbound({
    userId,
    channel: "sms",
    template: "form_signature_required",
    payload: { formId, formTitle, reminder: true }
  });
}

// ── Session / Booking ─────────────────────────────────────────────────────

export function notifyBookingConfirmed(userId: string, sessionId: string, scheduledAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "booking_confirmed",
    title: "Booking confirmed",
    body: `Your appointment is confirmed for ${new Date(scheduledAtIso).toLocaleString()}. Session: ${sessionId}`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "booking_confirmed", payload: { sessionId, scheduledAtIso } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "booking_confirmed", payload: { sessionId, scheduledAtIso } });
}

export function notifyBookingUnderReview(userId: string, bookingRequestId: string) {
  notificationsStore.pushInApp({
    userId,
    type: "booking_under_review",
    title: "Booking request received",
    body: "Your booking request is under review. Our team will be in touch to confirm your session."
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "booking_under_review", payload: { bookingRequestId } });
}

export function notifyBookingRejected(userId: string, bookingRequestId: string, reason: string) {
  notificationsStore.pushInApp({
    userId,
    type: "booking_rejected",
    title: "Booking request declined",
    body: `Your booking request was declined. Reason: ${reason}. Please submit a new request.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "booking_rejected", payload: { bookingRequestId, reason } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "booking_rejected", payload: { bookingRequestId, reason } });
}

export function notifyBookingCancelled(userId: string, sessionId: string, reason?: string) {
  notificationsStore.pushInApp({
    userId,
    type: "booking_cancelled",
    title: "Session cancelled",
    body: reason
      ? `Your session has been cancelled. Reason: ${reason}`
      : `Your session has been cancelled. Please contact us to reschedule.`
  });
}

export function notifySessionReminder(userId: string, sessionId: string, scheduledAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "session_reminder",
    title: "Session reminder",
    body: `Reminder: you have a session scheduled for ${new Date(scheduledAtIso).toLocaleString()}.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "session_reminder", payload: { sessionId, scheduledAtIso } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "session_reminder", payload: { sessionId, scheduledAtIso } });
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

// ── Engagement ────────────────────────────────────────────────────────────

export function notifyCashbackUpdated(userId: string, newUnlockedKwd: string, changeKwd: string, reason: string) {
  notificationsStore.pushInApp({
    userId,
    type: "cashback_update",
    title: "Cashback balance updated",
    body: `Your cashback balance changed by ${changeKwd} KWD (${reason}). New balance: ${newUnlockedKwd} KWD.`
  });
}

export function notifyNewOfferAlert(userId: string, offerId: string, offerName: string) {
  notificationsStore.pushInApp({
    userId,
    type: "new_offer_alert",
    title: "New offer available",
    body: `A new offer matching your profile is now available: ${offerName}.`,
    actionUrl: `/offers/${offerId}`
  });
}

export function notifyMembershipActivated(userId: string, userOfferId: string, offerName: string, expiresAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "membership_activated",
    title: "Membership activated",
    body: `Your ${offerName} membership is now active. Valid until ${new Date(expiresAtIso).toLocaleDateString()}.`
  });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "membership_activated", payload: { userOfferId, offerName, expiresAtIso } });
}

export function notifyMembershipExpiring(userId: string, userOfferId: string, offerName: string, expiresAtIso: string) {
  notificationsStore.pushInApp({
    userId,
    type: "membership_expiring",
    title: "Membership expiring soon",
    body: `Your ${offerName} membership expires on ${new Date(expiresAtIso).toLocaleDateString()}. Renew to keep your benefits.`
  });
  notificationsStore.pushOutbound({ userId, channel: "sms", template: "membership_expiring", payload: { userOfferId, offerName, expiresAtIso } });
  notificationsStore.pushOutbound({ userId, channel: "email", template: "membership_expiring", payload: { userOfferId, offerName, expiresAtIso } });
}

export function notifyReferralFirstPurchase(
  referrerId: string,
  customerName: string,
  offerName: string,
  amountKwd: string,
  customerStatus: string = "active"
) {
  notificationsStore.pushInApp({
    userId: referrerId,
    type: "referral_first_purchase",
    title: "Referral converted!",
    body: `${customerName} just completed their first purchase — ${offerName} for ${amountKwd} KWD (account: ${customerStatus}).`
  });
}
