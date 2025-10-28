import express from 'express';
import {savePayment,getAllPayments} from "../controllers/paymentController.js";
const paymentRouter = express.Router();

// Route for saving payment
paymentRouter.post('/save', savePayment);

// Route for fetching all payments
paymentRouter.get('/all', getAllPayments);

export default paymentRouter;