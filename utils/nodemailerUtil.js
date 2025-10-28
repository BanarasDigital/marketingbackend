import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465, 
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, 
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection failed:', error.message);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

export const sendResetPasswordEmail = async (toEmail, resetToken) => {
  try {
    const resetUrl = `https://banarasdigitalsolution.com/reset-password?token=${encodeURIComponent(resetToken)}`;
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1a73e8;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${resetUrl}" 
           style="display:inline-block;background-color:#1a73e8;color:#fff;padding:10px 20px;
                  border-radius:5px;text-decoration:none;font-weight:bold;">
           Reset Password
        </a>
        <p style="margin-top:15px;">If you did not request this, please ignore this email.</p>
        <hr style="margin-top:25px;border:0;border-top:1px solid #ccc;" />
        <p style="font-size:12px;color:#888;">© ${new Date().getFullYear()} Banaras Digital Solution. All rights reserved.</p>
      </div>
    `;

    const mailOptions = {
      from: `"Banaras Digital Solution" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: 'Password Reset Instructions',
      html: htmlTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};
