import express from "express";
import { registerUser, loginUser, updateUserProfile,getUserProfile, logoutUser, getAllUsers, forgotPassword, resetPassword } from "../controllers/userController.js";
import { verifyUser } from "../middleware/auth.js";
import { extractS3Uploads, getUploadMiddleware } from "../middleware/upload.js";
 
const userRouter = express.Router();
const allowedFields = [
  { name: "profileImage", maxCount: 1 },
];

userRouter.post("/register", registerUser);
userRouter.get("/me",verifyUser, getUserProfile);
userRouter.get("/all", getAllUsers);
userRouter.post("/login", loginUser);
userRouter.put(
  "/update-profile",
  verifyUser,
  getUploadMiddleware(allowedFields),
  extractS3Uploads, 
  updateUserProfile
);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.delete("/logout", logoutUser);

export default userRouter;