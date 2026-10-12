import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { ensureIndex } from "./services/vectorstore.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN.split(","), credentials: false }));
app.use(express.json({ limit: "100kb" }));
if (env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  message: { message: "Too many attempts. Try again in a few minutes." },
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  await ensureIndex();
  app.listen(env.PORT, () => console.log(`🚀 API listening on http://localhost:${env.PORT}`));
}
start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
