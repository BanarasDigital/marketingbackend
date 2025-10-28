import Course from "../models/CourseModel";
import CourseStudent1 from "../models/CourseStudent";

const getDefaultResume = () => ({
  lastWatched: {
    moduleIndex: 0,
    topicIndex: 0,
    contentIndex: 0,
  },
  completedContent: [],
  moduleProgress: [],
  progressPercent: 0,
  watchedHours: 0,
  totalHours: 0,
  isCompleted: false,
});

export const getAllCourseResumes = async (req, res) => {
  try {
    const { courseId, userId } = req.query;
    const filter = {};
    if (courseId) filter.courseId = courseId;
    if (userId) filter.userId = userId;
    const courseStudents = await CourseStudent1.find(filter)
      .populate("userId", "name email")
      .lean();
    const allCourseIds = [...new Set(courseStudents.map((cs) => cs.courseId))];
    const coursesMap = {};
    if (allCourseIds.length > 0) {
      const courses = await Course.find(
        { _id: { $in: allCourseIds } },
        "title totalHours"
      ).lean();
      courses.forEach((c) => {
        coursesMap[c._id.toString()] = c;
      });
    }
    const resumeData = courseStudents.map((doc) => {
      const user =
        doc.userId && typeof doc.userId === "object"
          ? doc.userId
          : { _id: doc.userId };

      const course = coursesMap[doc.courseId] || {};

      const resume = doc.resume || getDefaultResume();

      return {
        _id: doc._id,
        userId: user._id,
        userName: user.name || user.email || "Unknown",
        userEmail: user.email || "N/A",
        courseId: doc.courseId,
        courseTitle: course.title || "Untitled Course",
        totalHours: course.totalHours || 0,
        watchedHours: resume.watchedHours || 0,
        progressPercent: resume.progressPercent || 0,
        lastWatched: resume.lastWatched || {},
        completedContent: resume.completedContent || [],
        moduleProgress: resume.moduleProgress || [],
        isCompleted: resume.isCompleted || false,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });
    res.status(200).json({
      success: true,
      count: resumeData.length,
      data: resumeData,
    });
  } catch (err) {
    console.error("❌ getAllCourseResumes error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all resumes",
      error: err.message,
    });
  }
};
