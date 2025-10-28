import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const courseSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      unique: true,
      required: true,
      default: () => uuidv4(),
    },
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    subtitle: { type: String },
    rating: { type: Number, default: 0 },
    image: { type: String },
    reviewsCount: { type: Number, default: 0 },
    studentsEnrolled: { type: Number, default: 0 },
    category: { type: String },
    type: {
      type: String,
      enum: ["Courses", "Services"],
      required: true,
    },
    previewVideo: { type: String },
    whatYouWillLearn: [{ type: String }],
    price: { type: Number },
    salePrice: { type: Number },
    topics: [{ type: String }],
    includes: [{ type: String }],
    requirements: [{ type: String }],
    description: { type: String },
    downloadBrochure: { type: String },
  },
  { timestamps: true }
);
courseSchema.index({ title: 1, type: 1 }, { unique: true });
courseSchema.pre("save", function (next) {
  if (!this.courseId) {
    this.courseId = uuidv4();
  }
  if (this.isModified("title") || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") 
      .replace(/\s+/g, "-")         
      .replace(/-+/g, "-");       
  }


  if (this.type === "Services") {
    this.previewVideo = undefined;
    this.whatYouWillLearn = undefined;
    this.price = undefined;
    this.salePrice = undefined;
    this.topics = undefined;
    this.requirements = undefined;
  } else if (this.type === "Courses") {
    this.downloadBrochure = undefined;
  }

  next();
});

const Course = mongoose.model("Course", courseSchema);
export default Course;
