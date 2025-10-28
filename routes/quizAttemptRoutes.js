import express from "express";
import {
  getUserQuizAttempts,
  saveOrUpdateAttempt,
  getAllAttempts,
} from "../controllers/quizAttemptController.js";
import { isAdmin, verifyUser } from "../middleware/auth.js";

const quizRouter = express.Router();
quizRouter.get("/all", verifyUser, isAdmin, getAllAttempts);
quizRouter.get("/quiz/:courseId", verifyUser, getUserQuizAttempts);
quizRouter.put("/quiz/:courseId", verifyUser, saveOrUpdateAttempt);

export default quizRouter;