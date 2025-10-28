import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "student"], default: "student" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    profileImage: { type: String },
    linkedin: { type: String, default: "" },
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
  },
  { timestamps: true }
);
userSchema.virtual("confirmPassword")
  .get(function () {
    return this._confirmPassword;
  })
  .set(function (value) {
    this._confirmPassword = value;
  });
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this._confirmPassword && this.password !== this._confirmPassword) {
    return next(new Error("Password and confirm password do not match"));
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const userModel = mongoose.models.user || mongoose.model("user", userSchema);
export default userModel;
