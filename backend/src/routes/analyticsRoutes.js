import express from "express";
import {
  getAnalyticsOverview,
  getGroupPerformance,
} from "../controllers/analyticsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const analyticsRouter = express.Router();

analyticsRouter.use(requireAuth, requireRole("professor"));
analyticsRouter.get("/overview", getAnalyticsOverview);
analyticsRouter.get("/group-performance", getGroupPerformance);
