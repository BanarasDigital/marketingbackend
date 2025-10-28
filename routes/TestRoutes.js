import express from "express";
import {
  saveTestData,
  getTestData,
  addCertificate,
  getCertificates,
} from "../controllers/testcontroller.js";
import { verifyUser } from "../middleware/auth.js";

const testRouter = express.Router();

testRouter.post("/save", verifyUser, saveTestData);
testRouter.get("/test/get", verifyUser, getTestData);
testRouter.post("/certificate", verifyUser, addCertificate);
testRouter.get("/certificate/get", verifyUser, getCertificates);

export default testRouter;
