import jwt from "jsonwebtoken";
import ms from "ms";
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
  const duration = ms(value);
  return typeof duration === "number" ? duration : 7 * 24 * 60 * 60 * 1000;
}

export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[JWT_COOKIE_NAME];
  const authorization = req.headers.authorization;
  const bearerMatch =
    typeof authorization === "string"
      ? /^Bearer ([^\s]+)$/i.exec(authorization)
      : null;
  const bearerToken = bearerMatch?.[1];

  if (!cookieToken && !bearerToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  for (const token of [cookieToken, bearerToken]) {
    if (!token) {
      continue;
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (
        typeof payload.userId !== "string"
        || typeof payload.email !== "string"
        || !["student", "professor"].includes(payload.role)
      ) {
        continue;
      }

      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };
      next();
      return;
    } catch {
      continue;
    }
  }

  res.status(401).json({ error: "Invalid or expired authentication token" });
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
