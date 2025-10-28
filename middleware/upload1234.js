// upload.js
import multer from "multer";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCloudFrontUrl } from "../utils/s3Helpers.js";

// ---------- CONFIG ----------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

// Rendition ladder (bitrate/size can be tuned)
const VIDEO_LADDER = [
  { name: "240p", width: 426, height: 240, vBitrate: "400k", aBitrate: "64k" },
  { name: "480p", width: 854, height: 480, vBitrate: "800k", aBitrate: "96k" },
  { name: "720p", width: 1280, height: 720, vBitrate: "2200k", aBitrate: "128k" },
];

// ---------- MULTER ----------
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

// ---------- HELPERS ----------
const safeBase = (name) =>
  path
    .basename(name, path.extname(name))
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "") || "upload";

const isVideo = (m) => (m || "").startsWith("video/");

const extFrom = (file) => {
  const ext = path.extname(file.originalname).slice(1);
  if (ext) return ext.toLowerCase();
  const mt = (file.mimetype || "").toLowerCase();
  const guess =
    mt === "image/jpeg" ? "jpg" :
    mt === "image/png" ? "png" :
    mt === "image/webp" ? "webp" :
    mt === "image/gif" ? "gif" :
    mt === "video/mp4" ? "mp4" :
    mt === "audio/mpeg" ? "mp3" :
    mt === "application/pdf" ? "pdf" : "";
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

const contentTypeFor = (key) => {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "pdf": return "application/pdf";
    case "mp4": return "video/mp4";
    case "m3u8": return "application/vnd.apple.mpegurl";
    case "mpd": return "application/dash+xml";
    case "m4s": return "video/iso.segment";   
    case "ts": return "video/mp2t";
    default: return "application/octet-stream";
  }
};

const putFile = async ({ localPath, key }) => {
  const Body = fsSync.createReadStream(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body,
    ContentType: contentTypeFor(key),
    CacheControl: "public, max-age=31536000",
  }));
};

const uploadDirToS3 = async (localDir, s3Prefix) => {
  const uploaded = [];
  const walk = async (dir, rel = "") => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const relPath = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) {
        await walk(abs, relPath);
      } else {
        const key = path.posix.join(s3Prefix, relPath).replace(/\\/g, "/");
        await putFile({ localPath: abs, key });
        uploaded.push(key);
      }
    }
  };
  await walk(localDir);
  return uploaded;
};

const execFFmpeg = (args, cwd) =>
  new Promise((resolve, reject) => {
    const child = execFile("ffmpeg", args, { cwd }, (err, _out, _err) => {
      if (err) return reject(Object.assign(err, { detail: _err }));
      resolve();
    });

  });

// Build HLS command (CMAF/fMP4 segments, master playlist)
const buildHLSArgs = (src, outDir) => {
  const maps = [];
  const args = ["-y", "-i", src, "-hide_banner"];

  // Keyframe / GOP settings suitable for 6s segments
  args.push("-preset", "veryfast", "-sc_threshold", "0", "-g", "48", "-keyint_min", "48");

  VIDEO_LADDER.forEach((r, i) => {
    // Scale each variant
    args.push(
      `-map`, "0:v:0",
      `-map`, "0:a:0?",
      `-c:v:${i}`, "libx264",
      `-b:v:${i}`, r.vBitrate,
      `-maxrate:v:${i}`, r.vBitrate,
      `-bufsize:v:${i}`, (parseInt(r.vBitrate) * 2) + "k",
      `-s:v:${i}`, `${r.width}x${r.height}`,
      `-profile:v:${i}`, i <= 1 ? "main" : "high",
      `-c:a:${i}`, "aac",
      `-b:a:${i}`, r.aBitrate,
      `-ar:${i}`, "48000",
      `-ac:${i}`, "2"
    );
    maps.push(`v:${i},a:${i}`);
  });

  args.push(
    "-f", "hls",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4",
    "-hls_flags", "independent_segments+split_by_time",
    "-master_pl_name", "master.m3u8",
    "-strftime_mkdir", "1",
    "-var_stream_map", maps.join(" "),
    "-hls_segment_filename", path.join(outDir, "v%v", "seg_%06d.m4s"),
    path.join(outDir, "v%v", "index.m3u8")
  );

  return args;
};

// Build DASH command (CMAF)
const buildDASHArgs = (src, outDir) => {
  const args = ["-y", "-i", src, "-hide_banner", "-preset", "veryfast", "-sc_threshold", "0"];

  VIDEO_LADDER.forEach((r, i) => {
    args.push(
      "-map", "0:v:0",
      "-c:v:" + i, "libx264",
      "-b:v:" + i, r.vBitrate,
      "-maxrate:v:" + i, r.vBitrate,
      "-bufsize:v:" + i, (parseInt(r.vBitrate) * 2) + "k",
      "-s:v:" + i, `${r.width}x${r.height}`,
      "-profile:v:" + i, i <= 1 ? "main" : "high"
    );
  });

  // Single audio mapped once (DASH can reuse)
  args.push(
    "-map", "0:a:0?",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-f", "dash",
    "-seg_duration", "6",
    "-use_template", "1",
    "-use_timeline", "1",
    "-init_seg_name", "init_$RepresentationID$.m4s",
    "-media_seg_name", "chunk_$RepresentationID$_$Number%05d$.m4s",
    path.join(outDir, "manifest.mpd")
  );

  return args;
};

const transcodeToHLSAndDASH = async (srcPath, workRoot) => {
  const hlsDir = path.join(workRoot, "hls");
  const dashDir = path.join(workRoot, "dash");
  await fs.mkdir(hlsDir, { recursive: true });
  await fs.mkdir(dashDir, { recursive: true });

  // HLS
  await execFFmpeg(buildHLSArgs(srcPath, hlsDir), workRoot);

  // DASH
  await execFFmpeg(buildDASHArgs(srcPath, dashDir), workRoot);

  return { hlsDir, dashDir, hlsMaster: path.join(hlsDir, "master.m3u8"), dashMPD: path.join(dashDir, "manifest.mpd") };
};

// ---------- MAIN MIDDLEWARE ----------
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
      const ext = extFrom(file);
      const baseName = safeBase(file.originalname);
      const fieldFolder = folderForField(file.fieldname);
      const uuid = uuidv4();

      // Always upload the original
      const originalKey = `${fieldFolder}/${Date.now()}-${uuid}-${baseName}.${ext}`;
      const originalBody = fsSync.createReadStream(tmpPath);

      let originalUrl = null;
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: originalKey,
          Body: originalBody,
          ContentType: file.mimetype || "application/octet-stream",
          CacheControl: "public, max-age=31536000",
        }));
        originalUrl = getCloudFrontUrl(originalKey);
      } catch (e) {
        // Continue; we’ll still attempt cleanup and report error below
      }

      // If video: transcode to HLS + DASH
      if (isVideo(file.mimetype)) {
        const workDir = path.join(os.tmpdir(), `xcode-${uuid}`);
        await fs.mkdir(workDir, { recursive: true });

        try {
          const { hlsDir, dashDir } = await transcodeToHLSAndDASH(tmpPath, workDir);

          // S3 prefixes for renditions
          const hlsPrefix = `${fieldFolder}/hls/${uuid}/`;
          const dashPrefix = `${fieldFolder}/dash/${uuid}/`;

          // Upload directories recursively
          await uploadDirToS3(hlsDir, hlsPrefix);
          await uploadDirToS3(dashDir, dashPrefix);

          const hlsUrl = getCloudFrontUrl(`${hlsPrefix}master.m3u8`);
          const dashUrl = getCloudFrontUrl(`${dashPrefix}manifest.mpd`);

          uploads.push({
            field: file.fieldname,
            type: file.mimetype,
            size: file.size,
            originalName: file.originalname,
            originalKey,
            originalUrl,
            hlsKey: `${hlsPrefix}master.m3u8`,
            hlsUrl,
            dashKey: `${dashPrefix}manifest.mpd`,
            dashUrl,
          });
        } catch (xerr) {
          uploads.push({
            field: file.fieldname,
            type: file.mimetype,
            size: file.size,
            originalName: file.originalname,
            originalKey,
            originalUrl,
            error: true,
            message: `Transcode/upload failed: ${xerr?.message || xerr}`,
          });
        } finally {
          // Cleanup workDir + tmpPath
          try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
          try { await fs.unlink(tmpPath); } catch {}
        }
      } else {
        // Non-video: just original
        uploads.push({
          field: file.fieldname,
          url: originalUrl,
          key: originalKey,
          originalName: file.originalname,
          type: file.mimetype,
          size: file.size,
        });

        try { await fs.unlink(tmpPath); } catch {}
      }
    }

    req.s3Uploads = uploads;
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
