import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { Document } from "../models/Document.js";
import { Organization } from "../models/Organization.js";
import { ChatLog } from "../models/ChatLog.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { answerQuestion } from "../services/rag.js";

const router = Router();
router.use(authenticate); // any signed-in role (admin or user)

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => req.auth.userId, // per-user, runs after authenticate
  validate: { keyGeneratorIpFallback: false },
  message: { message: "You're asking too fast. Wait a moment and try again." },
});

const chatSchema = z.object({
  question: z.string().trim().min(2, "Ask a longer question").max(1000, "Keep questions under 1000 characters"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(6)
    .default([]),
});

// Read-only list of what the org's knowledge base contains
router.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const docs = await Document.find({ orgId: req.auth.orgId, status: "ready" })
      .select("originalName pageCount createdAt")
      .sort({ originalName: 1 })
      .lean();
    res.json({ documents: docs });
  })
);

router.post(
  "/",
  chatLimiter,
  asyncHandler(async (req, res) => {
    const { question, history } = chatSchema.parse(req.body);
    const org = await Organization.findById(req.auth.orgId).lean(); // org comes from the JWT, not the client
    if (!org) throw new AppError(404, "Organization not found");

    const result = await answerQuestion({ org, question, history });

    ChatLog.create({
      orgId: req.auth.orgId,
      userId: req.auth.userId,
      question,
      answer: result.answer,
      grounded: result.grounded,
      sourceCount: result.sources.length,
      latencyMs: result.latencyMs,
    }).catch((e) => console.error("ChatLog failed", e));

    res.json(result);
  })
);

export default router;
