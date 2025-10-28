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

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [String],
    answer: mongoose.Schema.Types.Mixed,
    selectedAnswer: mongoose.Schema.Types.Mixed,
    multiSelect: Boolean,
    isCorrect: Boolean,
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

const enrolledCourseSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },
    title: { type: String, required: true },
    image: String,
    previewVideo: String,
    description: String,
    duration: String,
    badge: String,
    level: String,
    tags: [String],
    totalHours: Number,
    assessments: Number,
    assignments: Number,
    questions: Number,
    modules: [moduleSchema],
    finalTest: finalTestSchema,
  },
  { timestamps: true }
);

enrolledCourseSchema.pre("save", function (next) {
  if (this.title && !this.slug) {
    this.slug = generateSlug(this.title);
  }
  next();
});

const EnrolledCourse = mongoose.model("EnrolledCourse", enrolledCourseSchema);
export default EnrolledCourse;
