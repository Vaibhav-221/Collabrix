import express from "express";
import {
  login,
  logout,
  me,
  register,
} from "../controllers/authController.js";
import {
  loadCurrentUser,
  requireAuth,
} from "../middleware/auth.js";
import { loginLimiter, registrationLimiter } from "../middleware/rateLimit.js";

export const authRouter = express.Router();

authRouter.post("/register", registrationLimiter, register);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAuth, loadCurrentUser, me);
