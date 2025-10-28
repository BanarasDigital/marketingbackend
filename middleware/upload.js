import multer from "multer";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCloudFrontUrl } from "../utils/s3Helpers.js";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${uuidv4()}-${safeName}`);
  },
});

const createMulter = (maxFileSize = 4 * 1024 * 1024 * 1024) =>
  multer({ storage: diskStorage, limits: { fileSize: maxFileSize } });

export const getUploadMiddleware = (fieldConfig = null) => {
  const instance = createMulter();
  return fieldConfig ? instance.fields(fieldConfig) : instance.any();
};
const BUCKET = process.env.AWS_BUCKET_NAME;

const safeBase = (name) =>
  path
    .basename(name, path.extname(name))
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");

const extFrom = (file) => {
  const ext = path.extname(file.originalname).slice(1);
  if (ext) return ext;
  const mt = file.mimetype || "";
  const guess =
    mt === "image/jpeg"
      ? "jpg"
      : mt === "image/png"
      ? "png"
      : mt === "image/webp"
      ? "webp"
      : mt === "image/gif"
      ? "gif"
      : mt === "video/mp4"
      ? "mp4"
      : mt === "audio/mpeg"
      ? "mp3"
      : mt === "application/pdf"
      ? "pdf"
      : "";
  return guess || "bin";
};

const folderForField = (fieldname) => {
  if (!fieldname) return "others";
  if (fieldname.startsWith("content-image")) return "modules/images";
  if (fieldname.startsWith("content-audio")) return "modules/audios";
  if (fieldname.startsWith("content-video")) return "modules/videos";
  if (fieldname.startsWith("content-pdf")) return "modules/pdfs";

  if (fieldname === "image") return "courses/images";
  if (fieldname === "profileImage") return "users/profileImages";
  if (fieldname === "previewVideo") return "courses/previews";
  if (fieldname === "downloadBrochure") return "courses/brochures";
  if (fieldname === "blogImage") return "blogs/coverImages";
  if (fieldname === "blogAImages") return "blogs/authorImages";
  if (/^content-image-\d+/.test(fieldname)) return "blogs/contentBlocks";
  if (/^course-image/.test(fieldname)) return "courses/contentBlocks";

  return "others";
};
export const extractS3Uploads = async (req, res, next) => {
  const uploads = [];
  const files = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();

  if (!files.length) {
    req.s3Uploads = [];
    return next();
  }
  try {
    for (const file of files) {
      const tmpPath = file.path;
      const folder = folderForField(file.fieldname);
      const ext = extFrom(file);
      const base = safeBase(file.originalname) || "upload";
      const key = `${folder}/${Date.now()}-${uuidv4()}-${base}.${ext}`;
      const bodyStream = fsSync.createReadStream(tmpPath);

      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: bodyStream,
            ContentType: file.mimetype || "application/octet-stream",
            CacheControl: "public, max-age=31536000",
          })
        );

        const publicUrl = getCloudFrontUrl(key);
        uploads.push({
          field: file.fieldname,
          url: publicUrl,
          key,
          originalName: file.originalname,
          type: file.mimetype,
          size: file.size,
        });
      } catch (uploadErr) {
        uploads.push({
          field: file.fieldname,
          error: true,
          message: `S3 upload failed: ${uploadErr?.message || uploadErr}`,
          originalName: file.originalname,
          type: file.mimetype,
          size: file.size,
        });
      } finally {
        try {
          await fs.unlink(tmpPath);
        } catch (e) {
          console.warn("Temp cleanup warning:", tmpPath, e?.message || e);
        }
      }
    }
    req.s3Uploads = uploads;
    const hasFailure = uploads.some((u) => u.error);
    if (hasFailure) {
    }

    return next();
  } catch (err) {
    console.error("❌ Unexpected upload error:", err);
    await Promise.allSettled(
      files.map((f) => f?.path && fs.unlink(f.path).catch(() => {}))
    );
    return res.status(500).json({
      success: false,
      message: "Upload process failed",
      error: err?.message || String(err),
    });
  }
};
