import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  questionText: { type: String },
  selectedAnswers: [String],
  correctAnswers: [String],
  isCorrect: { type: Boolean },
});

const attemptSchema = new mongoose.Schema({
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percent: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  answers: [answerSchema],
  timestamp: { type: Date, default: Date.now },
});

const quizEntrySchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
  quizName: { type: String, required: true },
  testQuestions: [{ type: Object }],
  attempts: {
    type: [attemptSchema],
    validate: {
      validator: function (val) {
        return val.length <= this.maxAttempts;
      },
      message: "Exceeded max allowed attempts",
    },
  },
  maxScore: { type: Number },
  passPercentage: { type: Number, default: 80 },
  maxAttempts: { type: Number, default: 3 },
  certificateIssued: { type: Boolean, default: false }, 
});

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: String, required: true }, 
    courseTitle: { type: String, required: true },
    quizzes: [quizEntrySchema],
    finalTest: quizEntrySchema,
    allModulesCompleted: { type: Boolean, default: false },
    showUserInfo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
export default QuizAttempt;
