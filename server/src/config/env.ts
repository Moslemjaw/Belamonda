import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  SKIP_MONGO: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  // Comma-separated list of allowed origins (recommended). If omitted, falls back to CLIENT_ORIGIN.
  CLIENT_ORIGINS: z.string().optional(),
  CLIENT_ORIGIN: z.string().url().optional()
});

export const env = EnvSchema.parse(process.env);

