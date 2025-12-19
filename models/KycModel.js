import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true }, 
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    digioKycRequestId: { type: String, default: "" },
    digioKycRefId: { type: String, default: "" }, 
    kycUrl: { type: String, default: "" },
    kycStatus: {
      type: String,
      enum: ["CREATED", "IN_PROGRESS", "SUCCESS", "FAILED"],
      default: "CREATED",
    },
    kycRaw: { type: Object, default: {} },
    digioEsignDocumentId: { type: String, default: "" },
    esignUrl: { type: String, default: "" },
    esignStatus: {
      type: String,
      enum: ["NOT_STARTED", "REQUESTED", "COMPLETED", "FAILED"],
      default: "NOT_STARTED",
    },
    esignRaw: { type: Object, default: {} },
    signedDocumentUrl: { type: String, default: "" }, 
    signedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Kyc", kycSchema);
