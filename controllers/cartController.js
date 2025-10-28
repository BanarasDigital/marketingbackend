import Cart from "../models/CartModel.js";
import Course from "../models/CourseModel.js";

export const getCartByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error("❌ Error fetching cart:", err);
    res.status(500).json({ success: false, message: "Failed to fetch cart", error: err.message });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    const course = await Course.findOne({ courseId });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const cartItem = {
      courseId: course.courseId,
      title: course.title,
      price: course.price,
      salePrice: course.salePrice || null,
      image: course.image || "",
    };

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $addToSet: { items: cartItem } }, 
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error("❌ Error adding to cart:", err);
    res.status(500).json({ success: false, message: "Failed to add to cart", error: err.message });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { courseId } } },
      { new: true }
    );

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    res.status(200).json({ success: true, cart });
  } catch (err) {
    console.error("❌ Error removing from cart:", err);
    res.status(500).json({ success: false, message: "Failed to remove item", error: err.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    res.status(200).json({ success: true, message: "Cart cleared", cart });
  } catch (err) {
    console.error("❌ Error clearing cart:", err);
    res.status(500).json({ success: false, message: "Failed to clear cart", error: err.message });
  }
};
