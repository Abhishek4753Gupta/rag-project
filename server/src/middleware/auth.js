import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError, asyncHandler } from "../utils/errors.js";

/** Token carries: sub (user id), role, orgId. */
export function signToken(user) {
  return jwt.sign({ role: user.role, orgId: String(user.orgId) }, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError(401, "Authentication required");

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(401, "Session expired or invalid. Please sign in again.");
  }

  // Re-check the user on every request so deactivated/deleted users lose access immediately,
  // and so role/org always come from the DB-confirmed record that matches the token.
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive || String(user.orgId) !== payload.orgId) {
    throw new AppError(401, "Account no longer has access");
  }
  req.auth = { userId: String(user._id), orgId: String(user.orgId), role: user.role, name: user.name };
  next();
});

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.auth?.role) ? next() : next(new AppError(403, "You don't have permission to do that"));
