import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[cloudinary] CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set — image uploads (KYC, offers, promotions, invoices) will fail."
  );
}

export { cloudinary };
