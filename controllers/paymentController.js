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
  const { paymentId, razorpay, termsAccepted } = req.body;

  try {
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "Cannot initiate KYC without accepting Terms & Conditions",
      });
    }

    const payment = await Payment.findOne({ paymentId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    payment.paymentStatus = "success";
    payment.razorpay = razorpay;
    payment.paidAt = new Date();

    if (!payment.customerId) {
      payment.customerId = await generateCustomerId();
    }

    await payment.save();

    let kyc = await Kyc.findOne({ paymentId: payment._id });

    if (!kyc) {
      kyc = await Kyc.create({
        customerId: payment.customerId,
        paymentId: payment._id,
        kycStatus: "CREATED",
        esignStatus: "NOT_STARTED",
      });
    }

    // ✅ PRODUCTION redirect URL
    const clientBaseUrl = process.env.CLIENT_URL_PROD;
    if (!clientBaseUrl) {
      throw new Error("CLIENT_URL_PROD not configured");
    }

    const redirectUrl = `${clientBaseUrl.replace(/\/$/, "")}/kyc/digio/callback?paymentId=${payment.paymentId}`;

    const digioResp = await createKycRequest({
      customerId: payment.customerId,
      name: payment.name,
      email: payment.email,
      phone: payment.phone,
      redirect_url: redirectUrl,
    });

    const gatewayBase =
      process.env.DIGIO_GATEWAY_BASE ||
      "https://app.digio.in/#/gateway/login/";

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

    kyc.digioKycRequestId = digioResp.id || digioResp.request_id;
    kyc.kycUrl = kycUrl;
    kyc.kycStatus = "IN_PROGRESS";
    kyc.kycRaw = digioResp;
    await kyc.save();

    return res.status(200).json({
      success: true,
      customerId: payment.customerId,
      kycId: kyc._id,
      kycUrl,
    });

  } catch (err) {
    console.error("start-kyc error:", {
      code: err?.code,
      status: err?.status,
      digio: err?.digio,
    });

    if (err?.code === "DIGIO_KYC_FAILED" && err?.status === 401) {
      return res.status(502).json({
        success: false,
        message: "KYC service authentication failed. Please contact support.",
      });
    }

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
