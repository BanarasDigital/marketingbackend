import jwt from "jsonwebtoken";
import userModel from "../models/UserModel.js";

export const verifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not Authorized. Please log in again." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found. Please re-authenticate." });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);

    if (error.name === "TokenExpiredError") {
      return res
        .status(403)
        .json({ success: false, message: "Token expired. Please log in again." });
    }

    return res
      .status(403)
      .json({ success: false, message: "Invalid token. Access denied." });
  }
};


export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required." });
  }
};
export const isAuthVerify = (req, res, next) => {
  if (req.user && req.user.role === "student") {
    next();
  } else {
    return res
      .status(403)
      .json({ success: false, message: "Student access required." });
  }
};