import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { uploadStore } from "../lib/uploadStore.js";

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".mp3", ".wav", ".mov", ".mpeg", ".mpg", ".m4a", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

router.post("/uploads", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const uploadId = path.basename(req.file.filename, path.extname(req.file.filename));
  // Re-key by the uuid part (without extension) for clean lookup
  const fullId = req.file.filename; // e.g. "abc123.mp4"

  uploadStore.set(fullId, {
    filePath: req.file.path,
    originalName: req.file.originalname,
    sizeBytes: req.file.size,
  });

  res.json({
    uploadId: fullId,
    originalFilename: req.file.originalname,
    sizeBytes: req.file.size,
  });
});

export default router;
