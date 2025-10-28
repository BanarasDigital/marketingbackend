// models/Payment.js
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    couponCode: { type: String, default: null },
    discount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['success', 'failed'], default: 'success' },
    paymentId: { type: String, required: true },
    plan: { type: String, required: true },
    gstAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

// Exporting the Payment model
const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
