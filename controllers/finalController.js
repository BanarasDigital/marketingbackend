import TestResult from "../models/FinalTest.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function generateCertificateBuffer({ name, course, percent }) {
  const text = `Certificate\nName: ${name}\nCourse: ${course}\nScore: ${percent}%\n`;
  return Buffer.from(text, "utf-8");
}

async function uploadToS3({ bucket, key, body, contentType }) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export const saveTestResult = async (req, res, next) => {
  try {
    const {
      userId,
      quizId,        
      courseTitle,
      score,
      totalQuestions,
      percentage,
      answersByQuestion,
    } = req.body;
    let testResult = await TestResult.findOne({ userId, quizId });
    const attemptPayload = {
      score,
      percent: percentage,
      answersByQuestion: answersByQuestion || [],
      timestamp: new Date(),
    };

    if (!testResult) {
      testResult = await TestResult.create({
        userId,
        quizId,
        courseTitle,
        score,
        totalQuestions,
        percentage,
        maxScore: score,
        attemptsLeft: 2, // 3 - 1
        attempts: [attemptPayload],
        userAnswers: (answersByQuestion || []).map(a => ({ questionId: a.questionId, answers: a.userSelected || [] })),
      });
    } else {
      const prevAttempts = testResult.attempts || [];
      if (prevAttempts.length >= 3) {
        return res.status(400).json({ error: "No attempts left for this final test." });
      }
      const newAttempts = [...prevAttempts, attemptPayload].slice(-3);

      Object.assign(testResult, {
        score,
        totalQuestions,
        percentage,
        maxScore: Math.max(testResult.maxScore || 0, score),
        attemptsLeft: Math.max(0, 3 - newAttempts.length),
        attempts: newAttempts,
        userAnswers: (answersByQuestion || []).map(a => ({ questionId: a.questionId, answers: a.userSelected || [] })),
      });
      await testResult.save();
    }
    if (percentage >= 95 && !testResult.certificateUrl) {
      const certMeta = {
        name: req.user?.name || "Student",
        course: courseTitle,
        date: new Date().toLocaleDateString(),
        id: Date.now().toString(),
      };
      const fileBuffer = await generateCertificateBuffer({
        name: certMeta.name,
        course: certMeta.course,
        percent: percentage,
      });

      const key = `certificates/${userId}/${quizId}/${certMeta.id}.txt`; 
      const url = await uploadToS3({
        bucket: process.env.S3_BUCKET,
        key,
        body: fileBuffer,
        contentType: "text/plain", 
      });

      testResult.certificate = certMeta;
      testResult.certificateUrl = url;
      await testResult.save();
    }

    res.json({ success: true, testResult });
  } catch (err) {
    next(err);
  }
};

export const getUserResults = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const results = await TestResult.find({ userId }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    next(err);
  }
};
