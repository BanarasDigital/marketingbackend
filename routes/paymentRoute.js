import express from "express";
import { savePayment, getAllPayments, paymentSuccessAndStartKyc } from "../controllers/paymentController.js";

const paymentRouter = express.Router();

paymentRouter.post("/save", savePayment);
paymentRouter.post("/success/start-kyc", paymentSuccessAndStartKyc); 
paymentRouter.get("/all", getAllPayments);

export default paymentRouter;
