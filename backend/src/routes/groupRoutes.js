import express from "express";
import {
  createGroup,
  getMyGroup,
  inviteStudent,
  listInvitations,
  listGroupsForProfessor,
  removeMember,
  respondToInvitation,
} from "../controllers/groupController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const groupRouter = express.Router();

groupRouter.post("/", requireAuth, requireRole("student"), createGroup);
groupRouter.get("/", requireAuth, requireRole("professor"), listGroupsForProfessor);
groupRouter.get("/my-group", requireAuth, requireRole("student"), getMyGroup);
groupRouter.post("/invite", requireAuth, requireRole("student"), inviteStudent);
groupRouter.get("/invitations", requireAuth, requireRole("student"), listInvitations);
groupRouter.post("/invitations/:id/respond", requireAuth, requireRole("student"), respondToInvitation);
groupRouter.delete("/members/:userId", requireAuth, requireRole("student"), removeMember);
