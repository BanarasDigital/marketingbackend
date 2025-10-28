import dotenv from "dotenv";
import pkg from "twilio";

dotenv.config();

const { Twilio } = pkg;

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const otpStore = new Map();

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  const otp = generateOtp();
  otpStore.set(phone, otp);

  try {
    const message = await twilioClient.messages.create({
      body: `Banaras Digital Solution\nYour OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    console.log("OTP sent:", message.sid);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Twilio Error:", error.message);
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
};

export const verifyOtp = (req, res) => {
  const { phone, otp } = req.body;

  const storedOtp = otpStore.get(phone);

  if (!storedOtp) {
    return res.status(400).json({ message: "No OTP found for this phone" });
  }

  if (storedOtp !== otp) {
    return res.status(401).json({ message: "Invalid OTP" });
  }

  otpStore.delete(phone);

  res.status(200).json({
    message: "OTP verified successfully",
    access: "granted",
  });
};
