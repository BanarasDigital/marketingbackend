import mongoose from "mongoose";

const CartItemSchema = new mongoose.Schema({
  courseId: {
    type: String, 
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
    default: null,
  },
  image: {
    type: String,
    default: "",
  },
}, { _id: false }); 

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, 
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Cart", CartSchema);
