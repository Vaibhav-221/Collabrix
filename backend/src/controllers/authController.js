import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import {
  clearAuthCookie,
  createAuthToken,
  setAuthCookie,
} from "../middleware/auth.js";

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateRegistration(body) {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (fullName.length < 2 || fullName.length > 150) {
    throw validationError("Full name must be between 2 and 150 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("A valid email address is required");
  }
  if (!studentId) {
    throw validationError("Student ID is required");
  }
  if (password.length < 8) {
    throw validationError("Password must be at least 8 characters");
  }

  return { fullName, email, studentId, password };
}

function safeUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    studentId: row.student_id,
  };
}

export async function register(req, res, next) {
  try {
    const { fullName, email, studentId, password } =
      validateRegistration(req.body ?? {});
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (
         email,
         password_hash,
         full_name,
         student_id,
         role
       )
       VALUES ($1, $2, $3, $4, 'student')
       RETURNING id, email, full_name, student_id, role`,
      [email, passwordHash, fullName, studentId],
    );

    const user = result.rows[0];
    setAuthCookie(res, createAuthToken(user));
    res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      error.status = 409;
      error.message = "Email or student ID already registered";
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email =
      typeof req.body?.email === "string"
        ? normalizeEmail(req.body.email)
        : "";
    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await pool.query(
      `SELECT id, email, password_hash, full_name, student_id, role
       FROM users
       WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    setAuthCookie(res, createAuthToken(user));
    res.status(200).json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out" });
}

export function me(req, res) {
  res.status(200).json({
    user: safeUser({
      id: req.currentUser.id,
      email: req.currentUser.email,
      full_name: req.currentUser.full_name,
      role: req.currentUser.role,
      student_id: req.currentUser.student_id,
    }),
  });
}
