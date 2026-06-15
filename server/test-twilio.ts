import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function test() {
  try {
    console.log("Testing WhatsApp...");
    const msg1 = await client.messages.create({
      from: 'whatsapp:+14155238886',
      contentSid: 'HX229f5a04fd0510ce1b071852155d3e75',
      contentVariables: JSON.stringify({ "1": "123456" }),
      to: 'whatsapp:+96566666666' // Dummy number just to check if auth works or if it gives a specific error
    });
    console.log("WhatsApp Success:", msg1.sid);
  } catch (err: any) {
    console.error("WhatsApp Error:", err.message);
  }

  try {
    console.log("\nTesting SMS...");
    const msg2 = await client.messages.create({
      body: "Test SMS from Belamonda",
      from: process.env.TWILIO_PHONE_NUMBER,
      to: '+96566666666'
    });
    console.log("SMS Success:", msg2.sid);
  } catch (err: any) {
    console.error("SMS Error:", err.message);
  }
}

test();
