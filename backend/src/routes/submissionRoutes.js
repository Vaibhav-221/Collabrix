import express from "express";
import {
  getProfessorSubmissions,
} from "../controllers/submissionController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const submissionRouter = express.Router();

submissionRouter.get("/:id/submissions", requireAuth, requireRole("professor"), getProfessorSubmissions);
