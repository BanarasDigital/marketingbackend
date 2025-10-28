import Payment from "../models/PaymentModel.js";
import CourseStudent from "../models/CourseStudentModel.js";

export const verifyPurchasedCourse = async (req, res, next) => {
  try {
    const { _id: userId, email } = req.user || {};
    const courseId = req.params.courseId || req.body.courseId || req.query.courseId;

    if (!userId || !email || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Missing user ID, email, or course ID",
      });
    }
    const payment = await Payment.findOne({
      "user.email": email,
      "cartItems.courseId": courseId,
    });

    if (!payment) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No purchase record found for this course.",
      });
    }
    const enrolled = await CourseStudent.findOne({
      userId: userId,
      "enrolledCourses.courseId": courseId,
    });

    if (!enrolled) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not enrolled in this course.",
      });
    }
    req.courseStudent = enrolled;

    next();
  } catch (error) {
    console.error("verifyPurchasedCourse error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying purchase and enrollment.",
    });
  }
};
