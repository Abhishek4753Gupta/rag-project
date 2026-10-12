import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { Organization } from "../models/Organization.js";
import { User } from "../models/User.js";
import { signToken, authenticate } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { namespaceFor } from "../services/vectorstore.js";

const router = Router();

const password = z.string().min(8, "Password must be at least 8 characters").max(128);

const registerSchema = z.object({
  organizationName: z.string().trim().min(2, "Organization name is too short").max(120),
  adminName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";

const publicUser = (u, org) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  orgId: u.orgId,
  organizationName: org?.name,
});

// Public: register an organization + its first admin
router.post(
  "/register-organization",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (await User.exists({ email: body.email })) throw new AppError(409, "An account with this email already exists");

    const org = new Organization({ name: body.organizationName, slug: "pending", vectorNamespace: "pending" });
    org.slug = `${slugify(body.organizationName)}-${crypto.randomBytes(3).toString("hex")}`;
    org.vectorNamespace = namespaceFor(org._id); // dedicated vector namespace per organization
    await org.save();

    try {
      const admin = await User.create({
        name: body.adminName,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        role: "admin",
        orgId: org._id,
      });
      res.status(201).json({ token: signToken(admin), user: publicUser(admin, org) });
    } catch (e) {
      await Organization.deleteOne({ _id: org._id }); // roll back
      throw e;
    }
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select("+passwordHash");
    // Same error for unknown email / wrong password to avoid account enumeration
    const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new AppError(401, "Incorrect email or password");
    const org = await Organization.findById(user.orgId).lean();
    res.json({ token: signToken(user), user: publicUser(user, org) });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.userId).lean();
    const org = await Organization.findById(req.auth.orgId).lean();
    res.json({ user: publicUser(user, org) });
  })
);

export default router;
