import express from "express";
import {
  createCourse,
  getAllCourses,
  getCourseById,        
  deleteCourse,
  editCourse,
} from "../controllers/courseController.js";
import { verifyUser, isAdmin } from "../middleware/auth.js";
import { getUploadMiddleware, extractS3Uploads } from "../middleware/upload.js";
import { multerErrorHandler } from "../utils/multerErrorHandler.js";

const courseRouter = express.Router();
const allowedFields = [
  { name: "image", maxCount: 1 },
  { name: "previewVideo", maxCount: 1 },
  { name: "downloadBrochure", maxCount: 1 },
];

courseRouter.post(
  "/create",
  verifyUser,
  isAdmin,
  getUploadMiddleware(allowedFields),
  multerErrorHandler,
  extractS3Uploads,
  createCourse
);

courseRouter.put(
  "/edit/:idOrSlug",
  verifyUser,
  isAdmin,
  getUploadMiddleware(allowedFields),
  multerErrorHandler,
  extractS3Uploads,
  editCourse
);

courseRouter.get("/courseAll", getAllCourses);
courseRouter.get("/:idOrSlug", getCourseById);
courseRouter.delete("/:idOrSlug", deleteCourse);

export default courseRouter;
