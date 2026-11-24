import express from "express";
import {
  createGroup,
  getMyGroup,
  inviteStudent,
  listInvitations,
  removeMember,
  respondToInvitation,
} from "../controllers/groupController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const groupRouter = express.Router();

groupRouter.use(requireAuth, requireRole("student"));
groupRouter.post("/", createGroup);
groupRouter.get("/my-group", getMyGroup);
groupRouter.post("/invite", inviteStudent);
groupRouter.get("/invitations", listInvitations);
groupRouter.post("/invitations/:id/respond", respondToInvitation);
groupRouter.delete("/members/:userId", removeMember);
