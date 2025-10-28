import express from "express";
import { getAllForms, getFormHeadings, submitForm } from "../controllers/formController.js";

const formRouter = express.Router();

formRouter.post("/submit", submitForm);
formRouter.get("/all", getAllForms);
formRouter.get("/form-headings", getFormHeadings);
export default formRouter;
