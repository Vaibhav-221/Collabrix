import express from "express";
import {
  archiveAssignment,
  createAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
} from "../controllers/assignmentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const assignmentRouter = express.Router();

assignmentRouter.get("/", requireAuth, listAssignments);
assignmentRouter.get("/:id", requireAuth, getAssignment);
assignmentRouter.post("/", requireAuth, requireRole("professor"), createAssignment);
assignmentRouter.put("/:id", requireAuth, requireRole("professor"), updateAssignment);
assignmentRouter.delete("/:id", requireAuth, requireRole("professor"), archiveAssignment);
