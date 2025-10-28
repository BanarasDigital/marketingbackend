import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  addComment,
} from "../controllers/blogController.js";
import { extractS3Uploads, getUploadMiddleware } from "../middleware/upload.js";
import { multerErrorHandler } from "../utils/multerErrorHandler.js";

const blogRouter = express.Router();
const allowedFields = [
  { name: "blogImage", maxCount: 1 },
  { name: "blogAImages", maxCount: 1 },
  ...Array.from({ length: 10 }).map((_, i) => ({
    name: `content-image-${i + 1}`,
    maxCount: 1,
  })),
];

blogRouter.post(
  "/create",
  getUploadMiddleware(allowedFields),
  extractS3Uploads,
  multerErrorHandler,
  createBlog
);

blogRouter.get("/blogsAll", getAllBlogs);
blogRouter.get("/:slug", getBlogById);
blogRouter.put(
  "/:slug",
  getUploadMiddleware(allowedFields),
  extractS3Uploads,
  updateBlog
);
blogRouter.delete("/:slug", deleteBlog);
blogRouter.post("/:slug/comment", addComment);

export default blogRouter;
