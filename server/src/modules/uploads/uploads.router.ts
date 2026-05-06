import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    try {
      ensureUploadsDir();
      cb(null, UPLOADS_DIR);
    } catch (e) {
      cb(e as Error, UPLOADS_DIR);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").slice(0, 10) || ".bin";
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
    const name = `offer_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("ONLY_IMAGES_ALLOWED"));
    cb(null, true);
  }
});

export const uploadsRouter = Router();

uploadsRouter.post(
  "/image",
  authRequired,
  requireRole(["admin"]),
  upload.single("file"),
  (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "NO_FILE" });
    return res.status(201).json({ url: `/uploads/${encodeURIComponent(f.filename)}` });
  }
);

