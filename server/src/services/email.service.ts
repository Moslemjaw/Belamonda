/**
 * Email delivery service.
 *
 * Currently operates in "log-only" mode — every outbound email is printed
 * to stdout as a structured JSON line.  Swap the body of `sendEmail` for a
 * real transactional-email SDK call (SendGrid, Postmark, AWS SES, …) when
 * ready; the call-sites do not need to change.
 *
 * SMS / WhatsApp follow the same pattern: the architecture is wired and the
 * payload is logged; provider integration is out of scope for this task.
 */

export type EmailPayload = {
  to: string;
  template: string;
  subject: string;
  payload: Record<string, unknown>;
};

export type SmsPayload = {
  to: string;
  template: string;
  payload: Record<string, unknown>;
};

export function sendEmail(input: EmailPayload): void {
  // eslint-disable-next-line no-console
  console.log(
    `[email:send] template=${input.template} to=${input.to} subject="${input.subject}"`,
    JSON.stringify(input.payload)
  );
}

export function sendSms(input: SmsPayload): void {
  // eslint-disable-next-line no-console
  console.log(
    `[sms:send] template=${input.template} to=${input.to}`,
    JSON.stringify(input.payload)
  );
}

export function sendWhatsApp(input: SmsPayload): void {
  // eslint-disable-next-line no-console
  console.log(
    `[whatsapp:send] template=${input.template} to=${input.to}`,
    JSON.stringify(input.payload)
  );
}

/**
 * Resolve the email address for a user.  Returns undefined if the user
 * cannot be found; callers should skip delivery gracefully.
 *
 * Uses a dynamic import to avoid a circular-dependency cycle between the
 * email service and the Mongoose models that are loaded at boot.
 */
export async function resolveUserEmail(userId: string): Promise<string | undefined> {
  try {
    const { UserModel } = await import("../models/user.model.js");
    const mongoose = await import("mongoose");
    if (!mongoose.default.isValidObjectId(userId)) return undefined;
    const user = await UserModel.findById(userId).select("email").lean<{ email?: string } | null>();
    return user?.email ?? undefined;
  } catch {
    return undefined;
  }
}
