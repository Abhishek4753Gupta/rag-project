import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { z } from "zod";
import { env } from "../config/env.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { Document } from "../models/Document.js";
import { User } from "../models/User.js";
import { ChatLog } from "../models/ChatLog.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { ALLOWED_EXT, ingestDocument } from "../services/ingest.js";
import { deleteDocumentVectors } from "../services/vectorstore.js";

const router = Router();
router.use(authenticate, requireRole("admin")); // everything below is admin-only

/* ---------------------------------------------------------------- documents */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ALLOWED_EXT.includes(ext) ? cb(null, true) : cb(new AppError(400, `Allowed file types: ${ALLOWED_EXT.join(", ")}`));
  },
});

router.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const docs = await Document.find({ orgId: req.auth.orgId }).sort({ createdAt: -1 }).lean();
    res.json({ documents: docs });
  })
);

router.post(
  "/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "Attach a file to upload");
    const { buffer, originalname, mimetype, size } = req.file;
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    if (await Document.exists({ orgId: req.auth.orgId, hash })) {
      throw new AppError(409, "This exact file has already been uploaded");
    }

    const doc = await Document.create({
      orgId: req.auth.orgId,
      uploadedBy: req.auth.userId,
      originalName: path.basename(originalname),
      mimeType: mimetype,
      size,
      hash,
      status: "processing",
    });

    // Process in the background; the client polls the list for status changes.
    ingestDocument({ doc, buffer })
      .then(({ pageCount, chunkCount }) =>
        Document.updateOne({ _id: doc._id }, { status: "ready", pageCount, chunkCount, error: null })
      )
      .catch(async (err) => {
        console.error(`Ingestion failed for ${doc.originalName}:`, err);
        await Document.updateOne({ _id: doc._id }, { status: "failed", error: String(err.message).slice(0, 300) });
      });

    res.status(202).json({ document: doc });
  })
);

router.delete(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const doc = await Document.findOne({ _id: req.params.id, orgId: req.auth.orgId });
    if (!doc) throw new AppError(404, "Document not found");
    if (doc.chunkCount) await deleteDocumentVectors(req.auth.orgId, doc._id, doc.chunkCount);
    await doc.deleteOne();
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------- users */

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["admin", "user"]).default("user"),
});

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await User.find({ orgId: req.auth.orgId }).sort({ createdAt: 1 }).lean();
    res.json({ users: users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })) });
  })
);

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    if (await User.exists({ email: body.email })) throw new AppError(409, "An account with this email already exists");
    const user = await User.create({
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash: await bcrypt.hash(body.password, 12),
      orgId: req.auth.orgId, // org always comes from the admin's token, never from the request body
    });
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  })
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth.userId) throw new AppError(400, "You can't remove your own account");
    const result = await User.deleteOne({ _id: req.params.id, orgId: req.auth.orgId });
    if (!result.deletedCount) throw new AppError(404, "User not found");
    res.json({ ok: true });
  })
);

/* ----------------------------------------------------------------- activity */

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const logs = await ChatLog.find({ orgId: req.auth.orgId }).sort({ createdAt: -1 }).limit(50).populate("userId", "name").lean();
    const [total, unanswered] = await Promise.all([
      ChatLog.countDocuments({ orgId: req.auth.orgId }),
      ChatLog.countDocuments({ orgId: req.auth.orgId, sourceCount: 0 }),
    ]);
    res.json({
      stats: { total, unanswered },
      logs: logs.map((l) => ({
        id: l._id,
        user: l.userId?.name ?? "Removed user",
        question: l.question,
        answered: l.sourceCount > 0,
        latencyMs: l.latencyMs,
        createdAt: l.createdAt,
      })),
    });
  })
);

export default router;
