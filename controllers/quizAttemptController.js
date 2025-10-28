import QuizAttempt from "../models/QuizAttemptModel.js";

export const getUserQuizAttempts = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { courseId } = req.params;
    const data = await QuizAttempt.findOne({ userId, courseId });
    if (!data) return res.status(404).json({ message: "No data found." });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const saveOrUpdateAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
  const { quizId, score, userAnswers, quizTitle, totalQuestions } = req.body;

    let userAttempt = await QuizAttempt.findOne({ userId, courseId });

    if (!userAttempt) {
      userAttempt = new QuizAttempt({
        userId,
        courseId,
        courseTitle,
        quizzes: [],
        finalTest: {},
        allModulesCompleted,
      });
    }

    if (isFinalTest) {
      if (!userAttempt.finalTest?.quizId) {
        userAttempt.finalTest = {
          quizId: quizData.quizId,
          quizName: quizData.quizName,
          testQuestions: quizData.testQuestions,
          attempts: [quizData.attempt],
          maxScore: quizData.maxScore,
        };
      } else {
        userAttempt.finalTest.attempts.push(quizData.attempt);
      }
    } else {
      const existingQuiz = userAttempt.quizzes.find(
        (q) => q.quizId.toString() === quizData.quizId
      );
      if (existingQuiz) {
        existingQuiz.attempts.push(quizData.attempt);
      } else {
        userAttempt.quizzes.push({
          quizId: quizData.quizId,
          quizName: quizData.quizName,
          testQuestions: quizData.testQuestions,
          attempts: [quizData.attempt],
          maxScore: quizData.maxScore,
        });
      }
    }

    await userAttempt.save();
    res.status(200).json({ message: "Attempt saved successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllAttempts = async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = courseId ? { courseId } : {};
    const attempts = await QuizAttempt.find(filter).populate("userId", "name email");
    res.status(200).json(attempts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};