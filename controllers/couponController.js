import Coupon from '../models/Coupon.js';

// Function to generate a unique coupon code
const generateCouponCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "NKD";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate a new coupon
export const generateCoupon = async (req, res) => {
  const { discount, maxUsage } = req.body;

  if (!discount || discount < 1 || discount > 100) {
    return res.status(400).json({ message: "Discount must be between 1% and 100%" });
  }

  if (!maxUsage || maxUsage < 1) {
    return res.status(400).json({ message: "Max usage must be greater than 0" });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Coupon expires in 7 days
  const code = generateCouponCode(); // Generate a unique coupon code

  const coupon = new Coupon({
    code,
    discount,
    expiresAt,
    maxUsage, // Store the max usage for this coupon
    usedBy: [], // Ensure the usedBy field is always an array
  });

  try {
    await coupon.save();
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get users who have used the coupon
export const getUsedBy = async (req, res) => {
  const { couponCode } = req.params;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });
    
    if (!coupon) {
      return res.status(404).json({ message: "❌ Coupon not found" });
    }

    // Send the list of users who have used the coupon
    res.json(coupon.usedBy);
  } catch (err) {
    console.error("Error fetching used by list:", err);
    res.status(500).json({ message: "❌ Error fetching used by list" });
  }
};

// Validate a coupon code
export const validateCoupon = async (req, res) => {
  const { code, email } = req.body;
  
  if (!code || !/^NKD[0-9A-Z]{5}$/.test(code)) {
    return res.status(400).json({ isValid: false, message: "❌ Invalid coupon format" });
  }
  const coupon = await Coupon.findOne({ code });

  if (!coupon) return res.status(404).json({ isValid: false, message: "❌ Coupon not found" });
  if (coupon.expiresAt < new Date()) {
    return res.status(400).json({ isValid: false, message: "❌ Coupon expired" });
  }
  if (coupon.usedBy.includes(email)) {
    return res.status(400).json({ isValid: false, message: "❌ Coupon already used by this email" });
  }
  if (coupon.usedBy.length >= coupon.maxUsage) {
    return res.status(400).json({ isValid: false, message: "❌ Coupon usage limit reached" });
  }
  res.json({
    isValid: true,
    discountPercentage: coupon.discount,
    message: `✅ Coupon Applied: ${coupon.discount}% OFF`,
  });
  
  coupon.usedBy.push(email);
  await coupon.save();
};

// List active coupons (not expired)
export const listCoupons = async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({ expiresAt: { $gt: now } }).sort({ expiresAt: -1 });

  res.json(
    coupons.map((c, i) => ({
      id: i + 1,
      code: c.code,
      discount: `${c.discount}%`,
      expiresAt: c.expiresAt.toLocaleString(),
      maxUsage: c.maxUsage,
      usedByCount: Array.isArray(c.usedBy) ? c.usedBy.length : 0, 
    }))
  );
};

// Delete a coupon by code
export const deleteCoupon = async (req, res) => {
  const { code } = req.params;

  if (!code || !/^NKD[0-9A-Z]{5}$/.test(code)) {
    return res.status(400).json({ message: "❌ Invalid coupon code format" });
  }

  try {
    const deleted = await Coupon.findOneAndDelete({ code });

    if (!deleted) {
      return res.status(404).json({ message: "❌ Coupon not found" });
    }

    res.json({ message: `🗑️ Coupon "${code}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ message: "❌ Error deleting coupon", error: err.message });
  }
};
