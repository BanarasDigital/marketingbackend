// models/FinalTest.js
import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema(
  {
    score: Number,
    percent: Number,
    answersByQuestion: [
      {
        questionId: String,
        userSelected: [String],
        correctAnswers: [String],
      },
    ],
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const testResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quizId: { type: String, required: true },
    courseTitle: { type: String },
    score: { type: Number, default: 0 }, 
    totalQuestions: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }, 
    maxScore: { type: Number, default: 0 },   
    attemptsLeft: { type: Number, default: 3 },
    attempts: { type: [attemptSchema], default: [] },
    userAnswers: [
      {
        questionId: String,
        answers: [String],
      },
    ],
    certificate: {
      name: String,
      course: String,
      date: String,
      id: String,
    },
    certificateUrl: { type: String, default: "" }, 
  },
  { timestamps: true }
);

const TestResult = mongoose.model("TestResult", testResultSchema);
export default TestResult;
