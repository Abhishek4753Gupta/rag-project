import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../utils/errors.js";

export function notFound(_req, res) {
  res.status(404).json({ message: "Route not found" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: err.issues[0]?.message || "Invalid input",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return res.status(400).json({ message });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err?.code === 11000) return res.status(409).json({ message: "That record already exists" });

  // Surface upstream AI-provider throttling clearly
  const msg = String(err?.message || "");
  if (/429|quota|rate/i.test(msg)) return res.status(429).json({ message: "The AI service is busy. Try again in a moment." });
  if (/503|overloaded|unavailable/i.test(msg)) return res.status(503).json({ message: "The AI service is temporarily unavailable." });

  console.error(err);
  res.status(500).json({ message: "Something went wrong on our side" });
}
