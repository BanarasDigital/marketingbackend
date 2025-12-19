import path from "path";
import Payment from "../models/PaymentModel.js";
import Kyc from "../models/KycModel.js";
import { generateCustomerId } from "../utils/customerId.js";
import { createKycRequest } from "../utils/digioClient.js";
export const savePayment = async (req, res) => {
  const {
    name,
    phone,
    email,
    totalAmount,
    couponCode,
    discount,
    paymentId,
    plan,
    gstAmount,
    termsAccepted,
  } = req.body;

  try {
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "Terms & Conditions, Investor Charter and MITC must be accepted",
      });
    }

    const newPayment = new Payment({
      name,
      phone,
      email,
      totalAmount,
      couponCode,
      discount,
      paymentId,
      plan,
      gstAmount,

      // ✅ SAVE ACCEPTANCE
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });

    await newPayment.save();

    return res.status(201).json({
      success: true,
      message: "Payment saved successfully",
      payment: newPayment,
    });
  } catch (error) {
    console.error("Error saving payment:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// controllers/paymentController.js

export const paymentSuccessAndStartKyc = async (req, res) => {
  const {
    paymentId,   // UUID from frontend
    razorpay,
    termsAccepted,
  } = req.body;

  try {
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "Cannot initiate KYC without accepting Terms & Conditions",
      });
    }

    // 1️⃣ Find EXISTING payment (created in /save)
    const payment = await Payment.findOne({ paymentId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // 2️⃣ Mark payment as SUCCESS
    payment.paymentStatus = "success";   
    payment.razorpay = razorpay;
    payment.paidAt = new Date();        

    // 3️⃣ Generate customerId ONCE
    if (!payment.customerId) {
      payment.customerId = await generateCustomerId(); 
    }

    await payment.save();

    // 4️⃣ Prevent duplicate KYC
    let kyc = await Kyc.findOne({ paymentId: payment._id });

    if (!kyc) {
      kyc = await Kyc.create({
        customerId: payment.customerId,
        paymentId: payment._id,
        kycStatus: "CREATED",
        esignStatus: "NOT_STARTED",
      });
    }

    // 5️⃣ Create Digio KYC
    const digioResp = await createKycRequest({
      customerId: payment.customerId,
      name: payment.name,
      email: payment.email,
      phone: payment.phone,
      redirect_url: process.env.CLIENT_URL,
    });

    // 6️⃣ Normalize KYC URL (VERY IMPORTANT)
    const gatewayBase =
      process.env.DIGIO_GATEWAY_BASE ||
      "https://ext.digio.in/#/gateway/login/";

    const kycUrl =
      digioResp?.redirect_url ||
      digioResp?.kyc_url ||
      (digioResp?.id ? `${gatewayBase}${digioResp.id}` : "");

    if (!kycUrl) {
      return res.status(500).json({
        success: false,
        message: "Digio KYC URL not generated",
      });
    }

    // 7️⃣ Save Digio data
    kyc.digioKycRequestId = digioResp.id || digioResp.request_id;
    kyc.kycUrl = kycUrl;
    kyc.kycStatus = "IN_PROGRESS";
    kyc.kycRaw = digioResp;
    await kyc.save();

    // 8️⃣ FINAL RESPONSE
    return res.status(200).json({
      success: true,
      customerId: payment.customerId,
      kycId: kyc._id,
      kycUrl,
    });

  } catch (err) {
    console.error("start-kyc error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to start KYC flow",
    });
  }
};



// existing
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
