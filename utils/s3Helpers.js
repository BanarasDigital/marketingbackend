import "dotenv/config";
const cloudfrontUrl = process.env.CLOUDFRONT_URL;
export const getCloudFrontUrl = (key) => {
  if (!cloudfrontUrl) throw new Error("CLOUDFRONT_URL not configured");
  return `${cloudfrontUrl}/${key}`;
};
