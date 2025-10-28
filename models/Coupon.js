import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  discount: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  maxUsage: {
    type: Number,
    required: true,
  },
  usedBy: {
    type: [String], // An array of emails of users who have used the coupon
    default: [],
  },
});

export default mongoose.model("Coupon", couponSchema);
