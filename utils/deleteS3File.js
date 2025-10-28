import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const deleteS3File = async (fileUrl) => {
  try {
    if (!fileUrl) return;
    const url = new URL(fileUrl);
    const Key = decodeURIComponent(url.pathname.slice(1)); 

    if (!Key) return;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`✅ Deleted from S3: ${Key}`);
  } catch (err) {
    console.error("❌ Failed to delete file from S3:", err.message || err);
  }
};