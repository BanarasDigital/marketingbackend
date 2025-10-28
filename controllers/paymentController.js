import Payment from "../models/PaymentModel.js";
export const savePayment = async (req, res) => {
  const { name, phone, email, totalAmount, couponCode, discount, paymentId, plan, gstAmount } = req.body;

  try {
    const newPayment = new Payment({
      name,
      phone,
      email,
      totalAmount,
      couponCode,
      discount,
      paymentId,
      plan,
      gstAmount,
    });

    await newPayment.save();
    return res.status(201).json({ message: 'Payment saved successfully', payment: newPayment });
  } catch (error) {
    console.error('Error saving payment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Controller function to get all payments
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }); 
    return res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
