import express from "express";
import { getKycByCustomerId, digioKycWebhook, digioEsignWebhook } from "../controllers/kycController.js";

const kycRouter = express.Router();

kycRouter.get("/status/:customerId", getKycByCustomerId);
kycRouter.post("/webhook/kyc", digioKycWebhook);
kycRouter.post("/webhook/esign", digioEsignWebhook);

export default kycRouter;
