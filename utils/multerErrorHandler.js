import multer from "multer";

// Handle multer errors globally
export const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("❌ Multer error:", err);
    return res.status(400).json({
      success: false,
      message: `Multer error: ${err.message}`,
    });
  } else if (err) {
    console.error("❌ Unknown error during upload:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Upload failed",
    });
  }
  next();
};