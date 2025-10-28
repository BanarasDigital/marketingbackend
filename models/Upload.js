import mongoose from "mongoose";

const RenditionSchema = new mongoose.Schema({
  name: String,        
  playlistUrl: String,  
  segmentPrefix: String 
}, { _id: false });

const UploadSchema = new mongoose.Schema({
  originalName: String,
  field: String,
  type: String,           
  size: Number,            
  s3Key: String,           
  url: String,             
  isVideo: Boolean,
  masterPlaylistUrl: String,
  renditions: [RenditionSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Upload", UploadSchema);
