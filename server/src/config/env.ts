import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Validate config at load time — Render shows this in logs if vars are missing. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  // Dev-only: when true, seeds demo users like cust1/admin1/fin1
  SEED_DEMO: z.coerce.boolean().default(false),
  // Comma-separated list of allowed origins (recommended). If omitted, falls back to CLIENT_ORIGIN.
  CLIENT_ORIGINS: z.string().optional(),
  CLIENT_ORIGIN: z.string().url().optional()
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid or missing environment variables:", parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error(
    "Required on Render: MONGODB_URI, JWT_SECRET (min 32 characters). Usually set CLIENT_ORIGINS to your Vercel URL.",
  );
  process.exit(1);
}

export const env = parsed.data;

