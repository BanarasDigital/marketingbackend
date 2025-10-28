import express from "express";
import multer from "multer";

const upload = multer({ dest: "temp/" });
import {
  createCourseStudent,
  getAllEnrolledCourses,
  getPurchasedEnrolledCourseDetailsByUser,
  updateCourseStudent,
  deleteCourseStudent,
  getCourseResume,
  updateCourseResume,
  updateProgress,
  addFinalTestToCourse,
  getAllCourseResumes,
  adminCourseProgressList,
  getFullCourseEnrollmentDetails,
} from "../controllers/courseStudentController.js";
import { isAdmin, verifyUser } from "../middleware/auth.js";
import { getUploadMiddleware, extractS3Uploads } from "../middleware/upload.js";
import { multerErrorHandler } from "../utils/multerErrorHandler.js";
const courseStudentRouter = express.Router();

courseStudentRouter.get("/all", getAllEnrolledCourses);
courseStudentRouter.get(
  "/getCourseByUser",
  verifyUser,
  getPurchasedEnrolledCourseDetailsByUser
);
courseStudentRouter.post(
  "/create",
  verifyUser,
  isAdmin,
  upload.any(),
  multerErrorHandler,
  extractS3Uploads,
  createCourseStudent
);
courseStudentRouter.post("/finalTest", verifyUser, addFinalTestToCourse);
courseStudentRouter.get("/:idOrSlug", verifyUser, getCourseResume);
courseStudentRouter.get("/all/resume", verifyUser, getAllCourseResumes);
courseStudentRouter.put("/resume/:idOrSlug", verifyUser, updateCourseResume);
courseStudentRouter.put(
  "/enrolled/:courseId",
  upload.any(),
  verifyUser,
  isAdmin,
  multerErrorHandler,
  extractS3Uploads,
  updateCourseStudent
);
courseStudentRouter.patch("/progress/:idOrSlug", verifyUser, updateProgress);
courseStudentRouter.delete(
  "/:courseId",
  verifyUser,
  isAdmin,
  deleteCourseStudent
);
courseStudentRouter.get("/admin/progress", adminCourseProgressList);
courseStudentRouter.get("/full-details/:courseId", verifyUser, getFullCourseEnrollmentDetails);


export default courseStudentRouter;
