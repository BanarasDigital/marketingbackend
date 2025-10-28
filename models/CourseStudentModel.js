import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

function arrayMinLength(val) {
  return Array.isArray(val) && val.length >= 1;
}

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: [arrayMinLength, "At least one option is required."],
    },
    answer: { type: mongoose.Schema.Types.Mixed, required: true },
    selectedAnswer: { type: mongoose.Schema.Types.Mixed },
    multiSelect: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["video", "pdf", "image", "audio", "test"],
      required: true,
    },
    name: String,
    duration: String,
    pages: String,
    url: String,
    completed: { type: Boolean, default: false },
    score: Number,
    questions: [questionSchema],
  },
  { _id: false }
);

const topicSchema = new mongoose.Schema(
  {
    topicId: { type: String, default: uuidv4 },
    topicTitle: String,
    completed: { type: Boolean, default: false },
    contents: [contentSchema],
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
  {
    moduleTitle: String,
    description: String,
    completed: { type: Boolean, default: false },
    topics: [topicSchema],
  },
  { _id: false }
);

const finalTestSchema = new mongoose.Schema(
  {
    name: String,
    type: { type: String, default: "test" },
    completed: { type: Boolean, default: false },
    score: Number,
    questions: [questionSchema],
  },
  { _id: false }
);

const courseResumeSchema = new mongoose.Schema(
  {
    courseId: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
  { timestamps: true }
);

const enrolledCourseSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    slug: { type: String },
    title: { type: String },
    image: String,
    previewVideo: String,
    description: { type: String },
    duration: String,
    badge: String,
    level: String,
    tags: [String],
    totalHours: Number,
    watchedHours: { type: Number, default: 0 },
    assessments: Number,
    assignments: Number,
    questions: Number,
    completedContent: { type: [String], default: [] },
    progress: { type: Boolean, default: false },
    progressPercent: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    lastWatched: {
      moduleIndex: Number,
      topicIndex: Number,
      contentIndex: Number,
    },
    modules: [moduleSchema],
    finalTest: finalTestSchema,
    resume: courseResumeSchema,
  },
  { _id: false }
);

enrolledCourseSchema.pre("save", function (next) {
  if (this.title && !this.slug) {
    this.slug = generateSlug(this.title);
  }
  next();
});

const courseStudentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enrolledCourses: [enrolledCourseSchema],
    //   globalProgressPercent: { type: Number, default: 0 },
    //   globalProgressColor: {
    //     type: String,
    //     enum: ["red", "yellow", "green"],
    //     default: "red",
    //   },
  },
  { timestamps: true }
);

// courseStudentSchema.methods.updateGlobalProgress = function () {
//   const enrolled = this.enrolledCourses || [];

//   const totalWatched = enrolled.reduce(
//     (acc, course) => acc + (course.watchedHours || 0),
//     0
//   );
//   const totalHours = enrolled.reduce(
//     (acc, course) => acc + (course.totalHours || 0),
//     0
//   );

//   const percent = totalHours
//     ? Math.round((totalWatched / totalHours) * 100)
//     : 0;

//   let color = "red";
//   if (percent > 85) color = "green";
//   else if (percent > 60) color = "yellow";

//   this.globalProgressPercent = percent;
//   this.globalProgressColor = color;
// };

const CourseStudent = mongoose.model("CourseStudent", courseStudentSchema);
export default CourseStudent;
