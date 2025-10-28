import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema({
  score: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  userAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const reportSchema = new mongoose.Schema({
  quizName: { type: String, default: "Untitled Quiz" },
  totalQuestions: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  lastScore: { type: Number, default: 0 },
  lastUserAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  correct: { type: Number, default: 0 },
  incorrect: { type: Number, default: 0 },
  percent: { type: Number, default: 0 },
  attempts: [attemptSchema],
});

const certificateSchema = new mongoose.Schema({
  title: { type: String, default: "Certificate of Completion" },
  issuedAt: { type: Date, default: Date.now },
  fileUrl: { type: String, default: "" },
});

const testSchema = new mongoose.Schema({
  userId: { type: String },
  quizId: { type: String },
  score: { type: Number },
  userAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  attemptCount: { type: Number, default: 1 },
  quizReport: reportSchema,
  certificates: [certificateSchema],
});

testSchema.index({ userId: 1, quizId: 1 }, { unique: true });

const Test = mongoose.model("Test", testSchema);
export default Test;
