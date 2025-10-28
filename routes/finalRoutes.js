import express from "express";
import {
  getUserResults,
  saveTestResult,
} from "../controllers/finalController.js";

const finalRouter = express.Router();

finalRouter.post("/save", saveTestResult);
finalRouter.get("/:userId", getUserResults);

export default finalRouter;
