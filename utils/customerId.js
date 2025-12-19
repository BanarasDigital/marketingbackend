import Counter from "../models/CounterModel.js";

export async function generateCustomerId() {
  const c = await Counter.findOneAndUpdate(
    { key: "customer_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const num = String(c.seq).padStart(4, "0"); 
  return `NKD${num}`;
}
