import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if env vars are present
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendSMS(to: string, body: string) {
  if (!client) {
    console.warn("Twilio client is not initialized. Missing environment variables. Simulating SMS:", { to, body });
    return;
  }
  
  if (!twilioPhoneNumber) {
    throw new Error("TWILIO_PHONE_NUMBER is not set.");
  }

  try {
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to
    });
    console.log("SMS sent successfully. SID:", message.sid);
    return message;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    throw error;
  }
}
