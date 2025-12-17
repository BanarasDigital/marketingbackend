import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./config/DB.js";

// Routers
import userRouter from "./routes/userRoute.js";
import paymentRouter from "./routes/paymentRoute.js";
import blogRouter from "./routes/blogRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import couponRouter from "./routes/couponsRoute.js";
import formRouter from "./routes/formRoutes.js";


const app = express();
const PORT = process.env.PORT || 9000;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://localhost:4174",
  "https://tradeohedge.com",
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  ...(process.env.NODE_ENV === "production"
    ? [process.env.CLIENT_URL_PROD, process.env.ADMIN_URL_PROD,"https://tradeohedge.com"]
    : []),
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, DELETE"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept"
    );
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.options("*", cors());
app.use(express.json({ limit: "4gb" }));
app.use(express.urlencoded({ extended: true, limit: "4gb" }));
app.use(express.static("public"));

// Connect to DB
connectDB();

app.get("/", (req, res) => {
  res.send("✅ Server is running.");
});

// Routes
app.use("/api/user", userRouter);
// app.use("/api/courses", courseRouter);
app.use("/api/forms", formRouter);
app.use("/api/payment", paymentRouter);
// app.use("/api/courseStudent", courseStudentRouter);
app.use("/api/blogs", blogRouter);
// app.use("/api/carts", cartRouter);
// app.use("/api/quizzes", quizRouter);
app.use("/api/coupons", couponRouter);
// app.use("/api/tests", testRouter);
// app.use("/api/otp", otpRouter);
// app.use("/api/final", finalRouter);

// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

app.listen(PORT, () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  } else {
    console.log(`✅ Server running on port ${PORT}`);
  }
  // init()
  //   .then(() => console.log("SQS listener started"))
  //   .catch((err) => console.error("Failed to start SQS listener:", err));
});
