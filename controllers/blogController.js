import Blog from "../models/Blog.js";
import { deleteS3File } from "../utils/deleteS3File.js";
import { v4 as uuidv4 } from "uuid";

const generateSlug = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const createBlog = async (req, res) => {
  try {
    const { title, excerpt, category, tags, content, authorName } = req.body;

    const contentImageUrls = {};
    for (const file of req.s3Uploads || []) {
      if (file.field.startsWith("content-image-")) {
        const idx = file.field.split("-")[2];
        if (!contentImageUrls[idx]) contentImageUrls[idx] = [];
        contentImageUrls[idx].push(file.url);
      }
    }

    const coverImageFile = (req.s3Uploads || []).find(
      (f) => f.field === "blogImage"
    );
    if (!coverImageFile) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required.",
      });
    }
    if (!title || !excerpt || !category || !content) {
      return res.status(400).json({
        success: false,
        message: "Title, excerpt, category, and content are required.",
      });
    }

    let updatedContent = [];
    try {
      const parsedContent =
        typeof content === "string" ? JSON.parse(content) : content;
      updatedContent = parsedContent.map((block) => {
        if (block.type === "image" && block.attrs?.localId !== undefined) {
          const idx = String(block.attrs.localId);
          const urls = contentImageUrls[idx] || [];
          block.value = urls.length > 1 ? urls : urls[0] || "";
        }
        return block;
      });
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid content JSON." });
    }

    const authorImageFile = (req.s3Uploads || []).find(
      (f) => f.field === "blogAImages"
    );

    const blogData = {
      id: uuidv4(),
      coverImage: coverImageFile.url,
      title: title.trim(),
      slug: generateSlug(title.trim()),
      excerpt: excerpt.trim(),
      category,
      tags: tags?.split(",").map((tag) => tag.trim()),
      author: {
        name: authorName?.trim() || "Admin",
        image: authorImageFile ? authorImageFile.url : "",
      },
      content: updatedContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const blog = new Blog(blogData);
    await blog.save();
    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    console.error("❌ Blog creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Blog
export const updateBlog = async (req, res) => {
  try {
    const { id, slug } = req.params;

    // Find blog by ID or slug
    const blog = id
      ? await Blog.findById(id)
      : await Blog.findOne({ slug });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    const uploads = req.s3Uploads || [];
    const newCoverImage = uploads.find((f) => f.field === "blogImage")?.url;
    const newAuthorImage = uploads.find((f) => f.field === "blogAImages")?.url;

    // Delete old cover image if replaced
    if (newCoverImage && blog.coverImage && blog.coverImage !== newCoverImage) {
      await deleteS3File(blog.coverImage);
    }

    // Delete old author image if replaced
    if (
      newAuthorImage &&
      blog.author?.image &&
      blog.author.image !== newAuthorImage
    ) {
      await deleteS3File(blog.author.image);
    }

    // Group uploaded files by field
    const fileMap = {};
    for (const file of uploads) {
      if (!fileMap[file.field]) fileMap[file.field] = [];
      fileMap[file.field].push(file.url);
    }

    // Handle updated content blocks
    let updatedContent = blog.content;
    if (req.body.content) {
      let parsedContent;
      try {
        parsedContent =
          typeof req.body.content === "string"
            ? JSON.parse(req.body.content)
            : req.body.content;
        if (!Array.isArray(parsedContent))
          throw new Error("Content must be an array");
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid content JSON." });
      }

      updatedContent = [];
      for (const block of parsedContent) {
        if (block.type === "image" && block.attrs?.localId !== undefined) {
          const field = `content-image-${block.attrs.localId}`;
          const newUrls = fileMap[field] || [];

          // Find old block for deletion
          const oldBlock = blog.content?.find(
            (b) =>
              b.type === "image" && b.attrs?.localId === block.attrs.localId
          );

          // Delete old S3 files if replaced
          if (oldBlock && oldBlock.value) {
            if (Array.isArray(oldBlock.value)) {
              for (const url of oldBlock.value) {
                if (!newUrls.includes(url)) await deleteS3File(url);
              }
            } else if (
              typeof oldBlock.value === "string" &&
              oldBlock.value &&
              !newUrls.includes(oldBlock.value)
            ) {
              await deleteS3File(oldBlock.value);
            }
          }

          block.value = newUrls.length > 1 ? newUrls : newUrls[0] || "";
        }
        updatedContent.push(block);
      }
    }

    // Update blog in DB
    const updated = await Blog.findByIdAndUpdate(
      blog._id, // always update using _id to avoid slug collisions
      {
        $set: {
          title: req.body.title || blog.title,
          slug:
            req.body.title && req.body.title !== blog.title
              ? generateSlug(req.body.title)
              : blog.slug,
          excerpt: req.body.excerpt || blog.excerpt,
          category: req.body.category || blog.category,
          tags: req.body.tags
            ? typeof req.body.tags === "string"
              ? req.body.tags.split(",").map((tag) => tag.trim())
              : req.body.tags
            : blog.tags,
          content: updatedContent,
          ...(newCoverImage && { coverImage: newCoverImage }),
          ...(newAuthorImage && { "author.image": newAuthorImage }),
          ...(req.body.authorName && { "author.name": req.body.authorName }),
        },
      },
      { new: true }
    );

    res.status(200).json({ success: true, blog: updated });
  } catch (err) {
    console.error("❌ Update Blog Error:", err);
    res.status(500).json({ success: false, message: "Blog update failed" });
  }
};


// Delete Blog by slug
export const deleteBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    // Delete cover image from S3
    if (blog.coverImage) await deleteS3File(blog.coverImage);
    if (blog.author?.image) await deleteS3File(blog.author.image);

    // Delete images from content blocks
    for (const block of blog.content || []) {
      if (block.type === "image" && block.value) {
        await deleteS3File(block.value);
      }
    }

    await blog.deleteOne();
    res.status(200).json({ success: true, message: "Blog deleted" });
  } catch (err) {
    console.error("❌ Delete Blog Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete blog" });
  }
};

// Get all blogs
export const getAllBlogs = async (_req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get blog by slug
export const getBlogById = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({ slug });
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    res.json({ success: true, blog });
  } catch (error) {
    console.error("Error fetching blog by slug:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add comment using slug
export const addComment = async (req, res) => {
  const { name, email, text, rating } = req.body;
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    blog.comments.push({ name, email, text, rating });
    await blog.save();

    res.status(201).json({
      success: true,
      message: "Comment added",
      comments: blog.comments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};