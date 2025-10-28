import { v4 as uuidv4 } from "uuid";
import Course from "../models/CourseModel.js";
import CourseStudent from "../models/CourseStudentModel.js";
import Payment from "../models/PaymentModel.js";
import userModel from "../models/UserModel.js";
import { deleteS3File } from "../utils/deleteS3File.js";
import CourseStudent1 from "../models/CourseStudent.js";
export const getDefaultResume = (totalHours = 0) => ({
  lastWatched: { moduleIndex: 0, topicIndex: 0, contentIndex: 0 },
  watchedHours: 0,
  totalHours,
  completedContent: [],
  moduleProgress: [],
  progressPercent: 0,
  isCompleted: false,
  progressBar: 0,
});
// ✅ Create course enrollment
export const createCourseStudent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      courseId,
      badge,
      level,
      tags,
      modules: rawModules,
      finalTest: rawFinalTest,
    } = req.body;

    const course = await Course.findOne({ courseId, type: "Courses" });
    if (!course) {
      return res
        .status(404)
        .json({ message: "Course not found or not a Student-type course" });
    }

    const s3Uploads = req.s3Uploads || [];
    const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags || [];
    const parsedModules =
      typeof rawModules === "string"
        ? JSON.parse(rawModules)
        : rawModules || [];
    const parsedFinalTest =
      typeof rawFinalTest === "string"
        ? JSON.parse(rawFinalTest)
        : rawFinalTest || null;

    let totalDuration = 0;
    let assessments = 0;
    let assignments = 0;

    const modules = parsedModules.map((mod, mIndex) => ({
      moduleTitle: mod.moduleTitle,
      description: mod.description,
      completed: mod.completed || false,
      topics: (mod.topics || []).map((topic, tIndex) => {
        const updatedContents = (topic.contents || []).map(
          (content, cIndex) => {
            const fieldPrefix = `content-${content.type}-${mIndex}-${tIndex}-${cIndex}`;
            const matchedFile = s3Uploads.find(
              (file) => file.field === fieldPrefix
            );

            let duration = 0;
            if (
              typeof content.duration === "string" &&
              content.duration.includes(":")
            ) {
              const parts = content.duration.split(":").map(Number).reverse();
              duration =
                (parts[0] || 0) + (parts[1] || 0) * 60 + (parts[2] || 0) * 3600;
            } else {
              duration = Number(content.duration) || 0;
            }

            totalDuration += duration;
            assessments++;

            const questions = (content.questions || []).map((q) => ({
              question: q.question,
              options: q.options,
              answer: q.answer,
              selectedAnswer: q.selectedAnswer || "",
              multiSelect: q.multiSelect || false,
              isCorrect: q.isCorrect || false,
            }));

            if (questions.length > 0) assignments++;

            return {
              type: content.type,
              name: matchedFile?.originalName || content.name || "",
              duration,
              pages: content.pages || "",
              url: matchedFile?.url || content.url || "",
              completed: content.completed || false,
              score: content.score || 0,
              questions,
            };
          }
        );

        return {
          topicId: uuidv4(),
          topicTitle: topic.topicTitle,
          completed: topic.completed || false,
          contents: updatedContents,
        };
      }),
    }));

    const finalTest = parsedFinalTest
      ? {
          name: parsedFinalTest.name || "Final Assessment",
          type: "test",
          completed: parsedFinalTest.completed || false,
          score: parsedFinalTest.score || 0,
          questions: (parsedFinalTest.questions || []).map((q) => ({
            question: q.question,
            options: q.options,
            answer: q.answer,
            selectedAnswer: q.selectedAnswer || "",
            multiSelect: q.multiSelect || false,
            isCorrect: q.isCorrect || false,
          })),
        }
      : null;

    const enrolledCourse = {
      courseId,
      title: course.title,
      image: course.image,
      description: course.description,
      previewVideo: course.previewVideo,
      badge: badge || "",
      level: level || "Beginner",
      tags: parsedTags,
      totalHours: totalDuration,
      watchedHours: 0,
      assessments,
      assignments,
      questions: finalTest?.questions?.length || 0,
      modules,
      finalTest,
      progress: false,
      progressPercent: 0,
      isCompleted: false,
      startedAt: new Date(),
      resume: getDefaultResume(totalDuration),
    };

    let courseStudent = await CourseStudent.findOne({ userId });

    if (!courseStudent) {
      courseStudent = new CourseStudent({
        userId,
        enrolledCourses: [enrolledCourse],
      });
    } else {
      const already = courseStudent.enrolledCourses.find(
        (c) => c.courseId?.toString() === courseId.toString()
      );
      if (already) {
        return res
          .status(400)
          .json({ message: "Already enrolled in this course" });
      }
      courseStudent.enrolledCourses.push(enrolledCourse);
    }

    courseStudent.updateGlobalProgress?.();
    const saved = await courseStudent.save();

    return res.status(201).json({
      message: "✅ Enrollment created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("❌ createCourseStudent error:", error);
    next(error);
  }
};
// ✅ Get all students (Admin)
export const getAllEnrolledCourses = async (req, res, next) => {
  try {
    const { courseId } = req.query;

    const students = await CourseStudent.find();

    let totalEnrolledCourses = 0;
    let totalEnrolledUsers = 0;
    const enrolledCourses = [];
    const uniqueCourseIds = new Set();

    for (const student of students) {
      const courses = Array.isArray(student.enrolledCourses)
        ? student.enrolledCourses
        : [];

      const filteredCourses = courseId
        ? courses.filter((c) => c.courseId?.toString() === courseId)
        : courses;

      if (filteredCourses.length > 0) {
        totalEnrolledUsers += 1;
      }

      totalEnrolledCourses += filteredCourses.length;

      for (const course of filteredCourses) {
        const courseObj =
          typeof course.toObject === "function" ? course.toObject() : course;

        if (courseObj.courseId) {
          uniqueCourseIds.add(courseObj.courseId.toString());
        }

        enrolledCourses.push({
          userId: student.userId,
          ...courseObj,
        });
      }
    }

    // ✅ Fetch all courses of type "Student" with only courseId and title
    const studentCourses = await Course.find({ type: "Courses" }).select(
      "courseId title"
    );

    return res.status(200).json({
      success: true,
      summary: {
        totalEnrolledUsers,
        totalEnrolledCourses,
        totalUniqueCourses: uniqueCourseIds.size,
      },
      enrolledCourses,
      studentCourses,
    });
  } catch (err) {
    console.error("Failed to fetch enrolled courses:", err);
    next({
      statusCode: 500,
      message: "Failed to fetch enrolled courses",
      error: err.message,
    });
  }
};
// ✅ Get all or specific enrolled course (must be purchased)
export const getPurchasedEnrolledCourseDetailsByUser = async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ 1. Get user
    const user = await userModel.findById(userId).select("email");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ 2. Get all successful payments
    const payments = await Payment.find({
      "user.email": user.email,
      razorpay_payment_id: { $exists: true, $ne: null },
    });

    if (!payments.length) {
      return res.status(200).json({
        success: true,
        enrolledCourses: [],
        message: "No successful payments found for this user.",
      });
    }

    // ✅ 3. Extract purchased course UUIDs
    const purchasedCourseIds = [
      ...new Set(
        payments.flatMap((p) =>
          p.cartItems.map((item) => item.courseId?.toString()).filter(Boolean)
        )
      ),
    ];

    if (!purchasedCourseIds.length) {
      return res.status(200).json({
        success: true,
        enrolledCourses: [],
        message: "No valid course IDs found in payments.",
      });
    }

    // ✅ 4. Find enrolled course data by matching courseId in CourseStudent
    const courseStudent = await CourseStudent.findOne({
      "enrolledCourses.courseId": { $in: purchasedCourseIds },
    });

    if (!courseStudent || !courseStudent.enrolledCourses?.length) {
      return res.status(200).json({
        success: true,
        enrolledCourses: [],
        message: "No enrolled courses found for purchased courses.",
      });
    }

    // ✅ 5. Filter only enrolled courses that match purchased courseIds
    const matchedEnrolledCourses = courseStudent.enrolledCourses.filter(
      (course) => purchasedCourseIds.includes(course.courseId)
    );

    return res.status(200).json({
      success: true,
      enrolledCourses: matchedEnrolledCourses,
      message: `Found ${matchedEnrolledCourses.length} purchased & enrolled course(s).`,
    });
  } catch (err) {
    console.error("❌ Error in getPurchasedEnrolledCourseDetailsByUser:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled course details",
      error: err.message,
    });
  }
};
// function getDefaultResume() {
//   return {
//     watchedHours: 0,
//     completedContent: [],
//     lastWatched: { moduleIndex: 0, topicIndex: 0, contentIndex: 0 },
//     progressPercent: 0,
//     moduleProgress: [],
//     isCompleted: false,
//   };
// }
// Get Course Resume
export const getCourseResume = async (req, res) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.idOrSlug;
    const courseStudent = await CourseStudent1.findOne({ userId, courseId });
    if (!courseStudent) {
      return res.status(200).json({
        success: true,
        resume: getDefaultResume(),
        message: "No resume found, returning default resume",
      });
    }

    return res.status(200).json({
      success: true,
      resume: courseStudent.resume,
    });
  } catch (err) {
    console.error("❌ getCourseResume error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch resume",
      error: err.message,
    });
  }
};
// ✅ Get ALL resume data for ALL userId + courseId
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

      return {
        _id: doc._id,
        userId: user._id,
        userName: user.name || user.email || "Unknown",
        userEmail: user.email || "N/A",
        courseId: doc.courseId,
        courseTitle: course.title || "Untitled Course",
        totalHours: course.totalHours || 0,
        resume: doc.resume || getDefaultResume(),
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
// ✅ Update Resume Progress and Last Watched
export const updateCourseResume = async (req, res) => {
  try {
    const userId = req.user.id;
    const courseId = req.params.idOrSlug;

    const {
      lastWatched = {},
      watchedHours = 0,
      completedContent = [],
      totalHours = 0,
      moduleProgress = [],
    } = req.body;
    let courseStudent = await CourseStudent1.findOne({ userId, courseId });
    if (!courseStudent) {
      courseStudent = new CourseStudent1({
        userId,
        courseId,
        resume: getDefaultResume(),
      });
    }
    const resume = courseStudent.resume || getDefaultResume();
    const updatedCompletedContent = Array.from(
      new Set([...(resume.completedContent || []), ...(completedContent || [])])
    );
    resume.completedContent = updatedCompletedContent;
    resume.watchedHours = (resume.watchedHours || 0) + watchedHours;
    resume.totalHours = totalHours;
    resume.progressPercent = totalHours
      ? Math.round((resume.watchedHours / totalHours) * 100)
      : 0;
    resume.isCompleted = resume.progressPercent === 100;
    resume.moduleProgress = moduleProgress || resume.moduleProgress;

    resume.lastWatched = {
      moduleIndex: lastWatched.moduleIndex ?? resume.lastWatched.moduleIndex,
      topicIndex: lastWatched.topicIndex ?? resume.lastWatched.topicIndex,
      contentIndex: lastWatched.contentIndex ?? resume.lastWatched.contentIndex,
    };
    courseStudent.resume = resume;
    await courseStudent.save();
    return res.status(200).json({
      success: true,
      message: "Progress updated",
      resume: courseStudent.resume,
    });
  } catch (err) {
    console.error("❌ updateCourseResume error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update resume",
      error: err.message,
    });
  }
};
// ✅ Update watched progress
export const updateProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { courseId, watchedHours } = req.body;

    const student = await CourseStudent.findById(id);
    if (!student)
      return res.status(404).json({ message: "Student not found." });

    const course = student.enrolledCourses.find((c) => c.courseId === courseId);
    if (!course)
      return res
        .status(404)
        .json({ message: "Course not found in enrollment." });

    course.watchedHours = watchedHours;
    course.progressPercent = Math.min(
      100,
      Math.round((watchedHours / course.totalHours) * 100)
    );

    await student.save();
    res.status(200).json(course);
  } catch (err) {
    next(err);
  }
};
// ✅ Admin: update full enrolledCourses array
export const updateCourseStudent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { courseId } = req.params;
    const s3Uploads = req.s3Uploads || [];

    const courseStudent = await CourseStudent.findOne({ userId });
    if (!courseStudent) {
      return res.status(404).json({ message: "CourseStudent not found" });
    }

    const courseIndex = courseStudent.enrolledCourses.findIndex(
      (c) => c.courseId === courseId
    );
    if (courseIndex === -1) {
      return res.status(404).json({ message: "Enrolled course not found" });
    }

    const existingCourse =
      courseStudent.enrolledCourses[courseIndex].toObject();

    const {
      badge,
      level,
      tags,
      modules: rawModules,
      finalTest: rawFinalTest,
    } = req.body;
    let parsedTags = [];
    let parsedModules = [];
    let parsedFinalTest = null;

    try {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags || [];
      parsedModules =
        typeof rawModules === "string"
          ? JSON.parse(rawModules)
          : rawModules || [];
      parsedFinalTest =
        typeof rawFinalTest === "string"
          ? JSON.parse(rawFinalTest)
          : rawFinalTest || null;
    } catch (error) {
      return res.status(400).json({ message: "Invalid JSON in form data." });
    }

    let totalDuration = 0;
    let assessments = 0;
    let assignments = 0;
    const totalQuestions = parsedFinalTest?.questions?.length || 0;

    const modules = await Promise.all(
      parsedModules.map(async (mod, mIndex) => ({
        moduleTitle: mod.moduleTitle,
        description: mod.description,
        completed: mod.completed || false,
        topics: await Promise.all(
          (mod.topics || []).map(async (topic, tIndex) => {
            const updatedContents = await Promise.all(
              (topic.contents || []).map(async (content, cIndex) => {
                const fieldName = `content-${content.type}-${mIndex}-${tIndex}-${cIndex}`;
                const matchedFile = s3Uploads.find(
                  (f) => f.field === fieldName
                );
                let url = content.url || "";
                let name = content.name || content.file?.name || "";
                let duration = Number(content.duration || 0);
                if (
                  typeof content.duration === "string" &&
                  content.duration.includes(":")
                ) {
                  const parts = content.duration
                    .split(":")
                    .map(Number)
                    .reverse();
                  duration =
                    (parts[0] || 0) +
                    (parts[1] || 0) * 60 +
                    (parts[2] || 0) * 3600;
                }

                totalDuration += duration;
                assessments++;

                if (matchedFile) {
                  if (url) {
                    try {
                      await deleteS3File(url);
                      console.log("🗑️ Deleted old S3 file:", url);
                    } catch (err) {
                      console.warn(
                        "⚠️ Failed to delete old S3 file:",
                        err.message
                      );
                    }
                  }
                  url = matchedFile.url;
                  name = matchedFile.originalName;
                }

                const questions = (content.questions || []).map((q) => ({
                  question: q.question,
                  options: q.options,
                  answer: q.answer,
                  selectedAnswer: q.selectedAnswer || "",
                  multiSelect: q.multiSelect || false,
                  isCorrect: q.isCorrect || false,
                }));

                if (questions.length > 0) assignments++;

                return {
                  type: content.type,
                  name,
                  url,
                  duration,
                  pages: content.pages || "",
                  completed: content.completed || false,
                  score: content.score || 0,
                  questions,
                };
              })
            );

            return {
              topicId: topic.topicId || uuidv4(),
              topicTitle: topic.topicTitle,
              completed: topic.completed || false,
              contents: updatedContents,
            };
          })
        ),
      }))
    );

    const finalTest = parsedFinalTest
      ? {
          name: parsedFinalTest.name || "Final Assessment",
          type: "test",
          completed: parsedFinalTest.completed || false,
          score: parsedFinalTest.score || 0,
          questions: (parsedFinalTest.questions || []).map((q) => ({
            question: q.question,
            options: q.options,
            answer: q.answer,
            selectedAnswer: q.selectedAnswer || "",
            multiSelect: q.multiSelect || false,
            isCorrect: q.isCorrect || false,
          })),
        }
      : null;

    function formatTotalHours(seconds) {
      if (seconds < 1) return `0 min`;
      const totalMinutes = Math.round(seconds / 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (hrs === 0) return `${mins} min`;
      if (mins === 0) return `${hrs}h`;
      return `${hrs}h ${mins}m`;
    }

    const updatedCourse = {
      ...existingCourse,
      badge: badge || "",
      level: level || "Beginner",
      tags: parsedTags,
      totalHours: totalDuration,
      totalHoursDisplay: formatTotalHours(totalDuration),
      assessments,
      assignments,
      questions: totalQuestions,
      modules,
      finalTest,
      updatedAt: new Date(),
      courseId,
    };

    courseStudent.enrolledCourses[courseIndex] = updatedCourse;

    courseStudent.updateGlobalProgress?.();
    const saved = await courseStudent.save();

    res.status(200).json({
      message: "✅ Course updated successfully",
      data: saved,
    });
  } catch (err) {
    console.error("❌ updateCourseStudent error:", err);
    next(err);
  }
};
// ✅ Delete CourseStudent (admin)
export const deleteCourseStudent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { courseId } = req.params;

    const courseStudent = await CourseStudent.findOne({ userId });
    if (!courseStudent) {
      return res.status(404).json({ message: "CourseStudent not found" });
    }

    const enrolledIndex = courseStudent.enrolledCourses.findIndex(
      (c) => c.courseId === courseId
    );

    if (enrolledIndex === -1) {
      return res.status(404).json({ message: "Course not enrolled" });
    }
    const enrolledCourse = courseStudent.enrolledCourses[enrolledIndex];
    for (const mod of enrolledCourse.modules || []) {
      for (const topic of mod.topics || []) {
        for (const content of topic.contents || []) {
          if (content.url) {
            await deleteS3File(content.url);
          }
        }
      }
    }
    if (enrolledCourse.finalTest) {
      for (const q of enrolledCourse.finalTest.questions || []) {
        if (q?.attachmentUrl) {
          await deleteS3File(q.attachmentUrl);
        }
      }
    }
    courseStudent.enrolledCourses.splice(enrolledIndex, 1);
    courseStudent.updateGlobalProgress?.();

    await courseStudent.save();

    res.status(200).json({ message: "✅ Course deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete courseStudent:", err);
    next(err);
  }
};
//Final Test added
export const addFinalTestToCourse = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { courseId, finalTest: rawFinalTest } = req.body;
    if (!courseId || !rawFinalTest) {
      return res.status(400).json({ message: "Missing courseId or finalTest" });
    }

    const parsedFinalTest =
      typeof rawFinalTest === "string"
        ? JSON.parse(rawFinalTest)
        : rawFinalTest;

    const courseStudent = await CourseStudent.findOne({ userId });
    if (!courseStudent) {
      return res.status(404).json({ message: "Student record not found" });
    }

    const enrolledCourse = courseStudent.enrolledCourses.find(
      (c) => c.courseId === courseId
    );

    if (!enrolledCourse) {
      return res.status(404).json({ message: "Enrolled course not found" });
    }
    const testName = parsedFinalTest.name?.trim();
    if (!testName) {
      return res.status(400).json({ message: "Test name is required." });
    }
    enrolledCourse.finalTest = {
      name: testName,
      type: "test",
      completed: false,
      score: 0,
      questions: (parsedFinalTest.questions || [])
        .filter(
          (q) =>
            q.question && typeof q.question === "string" && q.question.trim()
        )
        .map((q) => ({
          question: q.question.trim(),
          options: q.options,
          answer: q.answer,
          selectedAnswer: q.selectedAnswer || "",
          multiSelect: q.multiSelect || false,
          isCorrect: q.isCorrect || false,
        })),
    };

    enrolledCourse.questions = enrolledCourse.finalTest.questions.length;
    if (!Array.isArray(enrolledCourse.testNames)) {
      enrolledCourse.testNames = [];
    }
    if (!enrolledCourse.testNames.includes(testName)) {
      enrolledCourse.testNames.push(testName);
    }

    courseStudent.updateGlobalProgress?.();
    await courseStudent.save();

    return res.status(200).json({
      message: "✅ Final test added successfully.",
      finalTest: enrolledCourse.finalTest,
      testNames: enrolledCourse.testNames,
    });
  } catch (error) {
    console.error("❌ Error adding final test:", error);
    next(error);
  }
};
// // ✅ Admin: fetch username, course title, totalHours, watchedHours, progress bar (percent) list
// export const adminCourseProgressList = async (req, res) => {
//   try {
//     const {
//       userId,
//       courseId,
//       search,
//       page = 1,
//       limit = 20,
//     } = req.query;
//     const pg = Math.max(1, parseInt(page, 10) || 1);
//     const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
//     const skip = (pg - 1) * lim;
//     const baseFilter = {};
//     if (userId) baseFilter.userId = userId;  
//     if (courseId) baseFilter.courseId = String(courseId); 
//     if (search && search.trim()) {
//       const rx = new RegExp(search.trim(), "i");
//       const matchedUsers = await userModel
//         .find({ $or: [{ name: rx }, { email: rx }] }, { _id: 1 })
//         .lean();

//       const userIdsBySearch = matchedUsers.map((u) => u._id);
//       if (userIdsBySearch.length === 0) {
//         return res.status(200).json({
//           success: true, page: pg, limit: lim, total: 0, data: [],
//         });
//       }
//       baseFilter.userId = { $in: userIdsBySearch };
//     }
//     const [rows, total] = await Promise.all([
//       CourseStudent1.find(baseFilter)
//         .populate({ path: "userId", select: "name email" }) // ❌ no model here
//         .sort({ updatedAt: -1 })
//         .skip(skip)
//         .limit(lim)
//         .lean(),
//       CourseStudent1.countDocuments(baseFilter),
//     ]);
//     const courseIdStrs = [
//       ...new Set(
//         rows
//           .map((r) => (r.courseId ? String(r.courseId) : null))
//           .filter(Boolean)
//       ),
//     ];
//     const courseMap = {};
//     if (courseIdStrs.length > 0) {
//       const courses = await Course.find(
//         {
//           type: "Courses",
//           $or: [
//             { _id: { $in: courseIdStrs } },    
//             { courseId: { $in: courseIdStrs } }, 
//           ],
//         },
//         { title: 1, totalHours: 1, courseId: 1 }
//       ).lean();

//       for (const c of courses) {
//         if (c._id) courseMap[String(c._id)] = c;
//         if (c.courseId) courseMap[String(c.courseId)] = c;
//       }
//     }
//     const safePercent = (watched = 0, total = 0) => {
//       const w = Number(watched) || 0;
//       const t = Number(total) || 0;
//       if (t <= 0) return 0;
//       const pct = Math.round((w / t) * 100);
//       return Math.max(0, Math.min(100, pct));
//     };
//     const data = rows.map((doc) => {
//       const user = doc.userId || {};
//       const resume = doc.resume || {};

//       const cKey = String(doc.courseId || "");
//       const course = courseMap[cKey] || {};
//       const totalHours = Number(
//         resume.totalHours ?? course.totalHours ?? 0
//       );
//       const watchedHours = Number(resume.watchedHours ?? 0);

//       const progressPercent = Number(
//         resume.progressPercent ?? safePercent(watchedHours, totalHours)
//       );

//       return {
//         _id: doc._id,
//         userId: user._id,
//         userName: user.name || "Unknown",
//         userEmail: user.email || "",
//         courseId: doc.courseId,
//         courseTitle: course.title || "Untitled Course",
//         totalHours,
//         watchedHours,
//         progressPercent,
//         isCompleted: !!(resume.isCompleted || progressPercent === 100),
//         lastWatched:
//           resume.lastWatched || { moduleIndex: 0, topicIndex: 0, contentIndex: 0 },
//         updatedAt: doc.updatedAt,
//         createdAt: doc.createdAt,
//       };
//     });
//     return res.status(200).json({
//       success: true,
//       page: pg,
//       limit: lim,
//       total,
//       data,
//     });
//   } catch (err) {
//     console.error("❌ adminCourseProgressList error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch admin course progress list",
//       error: err.message,
//     });
//   }
// };
export const adminCourseProgressList = async (req, res) => {
  try {
    const { userId, courseId, search, page = 1, limit = 20, sort = "-updatedAt" } = req.query;

    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pg - 1) * lim;

    // Build match
    const match = {};
    if (userId) match.userId = new mongoose.Types.ObjectId(userId);
    if (courseId) match.courseId = String(courseId);

    // Pre-resolve search -> user ids (uses userModel, not populate)
    if (search && search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      const matched = await userModel.find({ $or: [{ name: rx }, { email: rx }] }, { _id: 1 }).lean();
      const ids = matched.map(u => u._id);
      if (ids.length === 0) {
        return res.status(200).json({ success: true, page: pg, limit: lim, total: 0, data: [] });
      }
      match.userId = { $in: ids };
    }

    // Sort parsing
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortDir = sort.startsWith("-") ? -1 : 1;

    const pipeline = [
      { $match: match },
      // join user by collection name (avoids Mongoose model registration)
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: "$user" },
      // join course by either _id string or courseId field
      {
        $lookup: {
          from: "courses",
          let: { cid: "$courseId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$type", "Courses"] },
                    { $or: [{ $eq: [{ $toString: "$_id" }, "$$cid"] }, { $eq: ["$courseId", "$$cid"] }] },
                  ],
                },
              },
            },
            { $project: { title: 1, totalHours: 1, _id: 1, courseId: 1 } },
          ],
          as: "course",
        },
      },
      { $addFields: { course: { $arrayElemAt: ["$course", 0] } } },
      {
        $addFields: {
          totalHours: { $ifNull: ["$resume.totalHours", { $ifNull: ["$course.totalHours", 0] }] },
          watchedHours: { $ifNull: ["$resume.watchedHours", 0] },
          progressPercent: {
            $ifNull: [
              "$resume.progressPercent",
              {
                $cond: [
                  { $lte: [{ $ifNull: ["$resume.totalHours", 0] }, 0] },
                  0,
                  {
                    $round: [
                      {
                        $multiply: [
                          { $divide: [{ $ifNull: ["$resume.watchedHours", 0] }, { $ifNull: ["$resume.totalHours", 0] }] },
                          100,
                        ],
                      },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { $sort: { [sortField]: sortDir } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: lim }],
          meta: [{ $count: "total" }],
        },
      },
      { $project: { rows: 1, total: { $ifNull: [{ $arrayElemAt: ["$meta.total", 0] }, 0] } } },
    ];

    const [out] = await CourseStudent1.aggregate(pipeline);
    const rows = out?.rows ?? [];
    const total = out?.total ?? 0;

    const data = rows.map(doc => ({
      _id: doc._id,
      userId: doc.userId,
      userName: doc.user?.name || "Unknown",
      userEmail: doc.user?.email || "",
      courseId: doc.courseId,
      courseTitle: doc.course?.title || "Untitled Course",
      totalHours: doc.totalHours || 0,
      watchedHours: doc.watchedHours || 0,
      progressPercent: doc.progressPercent || 0,
      isCompleted: !!(doc.resume?.isCompleted || (doc.progressPercent || 0) === 100),
      lastWatched: doc.resume?.lastWatched || { moduleIndex: 0, topicIndex: 0, contentIndex: 0 },
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
    }));

    return res.status(200).json({ success: true, page: pg, limit: lim, total, data });
  } catch (err) {
    console.error("adminCourseProgressList (agg) error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch admin course progress list", error: err.message });
  }
};

// ✅ Get full enrolled course details (modules, topics, content, quiz)
export const getFullCourseEnrollmentDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { courseId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    if (!courseId) {
      return res.status(400).json({ success: false, message: "Course ID required" });
    }
    const courseStudent = await CourseStudent.findOne({ userId });
    if (!courseStudent || !courseStudent.enrolledCourses?.length) {
      return res.status(404).json({
        success: false,
        message: "No enrolled courses found for this user",
      });
    }
    const enrolledCourse = courseStudent.enrolledCourses.find(
      (c) => c.courseId.toString() === courseId.toString()
    );

    if (!enrolledCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not enrolled or not found",
      });
    }
    const response = {
      courseId: enrolledCourse.courseId,
      title: enrolledCourse.title,
      image: enrolledCourse.image,
      level: enrolledCourse.level,
      totalHours: enrolledCourse.totalHours,
      progressPercent: enrolledCourse.progressPercent,
      isCompleted: enrolledCourse.isCompleted,
      startedAt: enrolledCourse.startedAt,
      modules: enrolledCourse.modules?.map((m) => ({
        moduleTitle: m.moduleTitle,
        description: m.description,
        completed: m.completed,
        topics: m.topics?.map((t) => ({
          topicTitle: t.topicTitle,
          completed: t.completed,
          contents: t.contents?.map((c) => ({
            name: c.name,
            type: c.type,
            duration: c.duration,
            url: c.url,
            completed: c.completed,
            score: c.score,
            questions: c.questions || [],
          })),
        })),
      })),
      finalTest: enrolledCourse.finalTest || null,
      resume: courseStudent.resume || null,
    };

    return res.status(200).json({
      success: true,
      message: "Full course enrollment details fetched successfully",
      data: response,
    });
  } catch (error) {
    console.error("❌ getFullCourseEnrollmentDetails error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course details",
      error: error.message,
    });
  }
};
