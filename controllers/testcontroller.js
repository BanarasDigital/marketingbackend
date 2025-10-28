import Test from "../models/TestModel.js";

// Save or update test
export const saveTestData = async (req, res) => {
  try {
    const { userId, quizId, score, userAnswers, report } = req.body;

    if (!userId || !quizId) {
      return res.status(400).json({ error: "Missing userId or quizId" });
    }

    let test = await Test.findOne({ userId, quizId });

    if (test) {
      test.score = score;
      test.userAnswers = userAnswers;
      test.attemptCount = (test.attemptCount || 0) + 1;

      test.quizReport = {
        ...test.quizReport,
        quizName: report?.quizName || test.quizReport.quizName,
        totalQuestions:
          report?.totalQuestions || test.quizReport.totalQuestions,
        maxScore: Math.max(test.quizReport.maxScore || 0, score),
        lastScore: score,
        lastUserAnswers: userAnswers,
        correct: report?.correct ?? test.quizReport.correct,
        incorrect: report?.incorrect ?? test.quizReport.incorrect,
        percent: report?.percent ?? test.quizReport.percent,
        attempts: [
          ...(test.quizReport?.attempts || []),
          { score, timestamp: new Date(), userAnswers },
        ],
      };

      await test.save();
      return res.json(test);
    }
    const newTest = new Test({
      userId,
      quizId,
      score,
      userAnswers,
      attemptCount: 1,
      quizReport: {
        quizName: report?.quizName || "Untitled Quiz",
        totalQuestions: report?.totalQuestions || 0,
        maxScore: score,
        lastScore: score,
        lastUserAnswers: userAnswers,
        correct: report?.correct || 0,
        incorrect: report?.incorrect || 0,
        percent: report?.percent || 0,
        attempts: [{ score, timestamp: new Date(), userAnswers }],
      },
      certificates: [],
    });

    await newTest.save();
    return res.json(newTest);
  } catch (error) {
    console.error("Save Test Error:", error);
    return res.status(500).json({ error: "Failed to save test data" });
  }
};

// Get test data
export const getTestData = async (req, res) => {
  try {
    const { userId, quizId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (quizId) {
      const test = await Test.findOne({ userId, quizId });
      if (!test) return res.json({});
      return res.json(test);
    }

    const tests = await Test.find({ userId });
    return res.json(tests);
  } catch (error) {
    console.error("Get Test Error:", error);
    return res.status(500).json({ error: "Failed to fetch test data" });
  }
};

// Add a certificate to a test
export const addCertificate = async (req, res) => {
  try {
    const { userId, quizId, title, fileUrl } = req.body;

    if (!userId || !quizId) {
      return res.status(400).json({ error: "Missing userId or quizId" });
    }

    const test = await Test.findOne({ userId, quizId });
    if (!test) return res.status(404).json({ error: "Test not found" });

    const certificate = {
      title: title || "Certificate of Completion",
      issuedAt: new Date(),
      fileUrl: fileUrl || "",
    };

    test.certificates.push(certificate);
    await test.save();

    return res.json(test.certificates);
  } catch (error) {
    console.error("Add Certificate Error:", error);
    return res.status(500).json({ error: "Failed to add certificate" });
  }
};

// Get certificates only
export const getCertificates = async (req, res) => {
  try {
    const { userId, quizId } = req.query;

    if (!userId || !quizId) {
      return res.status(400).json({ error: "Missing userId or quizId" });
    }

    const test = await Test.findOne({ userId, quizId });
    if (!test) return res.json([]);

    return res.json(test.certificates);
  } catch (error) {
    console.error("Get Certificates Error:", error);
    return res.status(500).json({ error: "Failed to fetch certificates" });
  }
};
