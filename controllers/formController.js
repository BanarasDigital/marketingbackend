import FormModel from "../models/FormModel.js";

export const submitForm = async (req, res) => {
  try {
    const form = await FormModel.create(req.body);
    res.status(201).json({ message: "Form submitted successfully", form });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getFormHeadings = async (req, res) => {
  try {
    const formHeadings = await FormModel.distinct('formHeading');
    res.status(200).json(formHeadings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllForms = async (req, res) => {
  let { formHeading, page = 1, limit = 10 } = req.query;
  page = parseInt(page);
  limit = parseInt(limit);

  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  const skip = Math.max((page - 1) * limit, 0);
  
  const filter = formHeading ? { formHeading: new RegExp(formHeading, 'i') } : {};

  try {
    const forms = await FormModel.find(filter)
      .skip(skip) 
      .limit(limit) 
      .exec();

    const totalForms = await FormModel.countDocuments(filter); 
    const totalPages = Math.ceil(totalForms / limit); 

    res.status(200).json({
      forms,
      totalForms,
      totalPages,
      currentPage: page,
      pageSize: limit,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


