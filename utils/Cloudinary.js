import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { localFilePath } from "./localFilePath.js";
import path from "path";

cloudinary.config({
    cloud_name: process.env.APP_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.APP_CLOUDINARY_API_KEY,
    api_secret: process.env.APP_CLOUDINARY_API_SECRET,
  });
var filePath;
const uploadOnCloudinary = async (localFilePathUrl) => {
  try {
    filePath = path.join(localFilePath(), "../" + localFilePathUrl);

    if (!filePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfull
    console.log("file is uploaded on cloudinary ", response.url);

    return response;
  } catch (error) {
    // fs.unlinkSync(filePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

export { uploadOnCloudinary };