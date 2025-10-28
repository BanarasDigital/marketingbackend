import mongoose from "mongoose";
const courseResumeSchema = new mongoose.Schema(
  {
    lastWatched: {
      moduleIndex: { type: Number, default: 0 },
      topicIndex: { type: Number, default: 0 },
      contentIndex: { type: Number, default: 0 },
    },
    completedContent: { type: [String], default: [] },
    moduleProgress: { type: [Object], default: [] },
    progressPercent: { type: Number, default: 0 },
    watchedHours: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const courseStudentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
    resume: courseResumeSchema,
  },
  { timestamps: true }
);

courseStudentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const CourseStudent1 = mongoose.model("CourseStudent1", courseStudentSchema);
export default CourseStudent1;
