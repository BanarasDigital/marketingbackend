import mongoose from "mongoose";

const formModelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      match: [/\S+@\S+\.\S+/, "Invalid email format"],
    },
    phone: {
      type: String,
    },
    subject: {
      type: String,
    },
    message: {
      type: String,
    },
    course: {
      type: String,
    },
    formHeading: {
      type: String,
    },
    courseTitle: {
      type: String,
    },
    policy: {
      type: Boolean,
    },
    type: {
      type: String,
      enum: ["brochure", "connect", "general"],
      default: "general",
    },
  },
  { timestamps: true }
);

const FormModel = mongoose.model("Form", formModelSchema);
export default FormModel;
