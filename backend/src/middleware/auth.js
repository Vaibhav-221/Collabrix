import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../config/db.js";

export const JWT_COOKIE_NAME = "jwt";

export function createAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function setAuthCookie(res, token) {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: getJwtCookieMaxAge(env.jwtExpiresIn),
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
  });
}

function getJwtCookieMaxAge(value) {
  const match = /^(\d+)([dhms])?$/.exec(value);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[JWT_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (
      typeof payload.userId !== "string"
      || typeof payload.email !== "string"
      || !["student", "professor"].includes(payload.role)
    ) {
      res.status(401).json({ error: "Invalid authentication token" });
      return;
    }

    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    void error;
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export async function loadCurrentUser(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, student_id, role
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      clearAuthCookie(res);
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    req.currentUser = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}
