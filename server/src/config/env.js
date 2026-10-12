import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  GOOGLE_API_KEY: z.string().min(1),
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIM: z.coerce.number().default(3072),
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX: z.string().default("marginalia"),
  PINECONE_CLOUD: z.string().default("aws"),
  PINECONE_REGION: z.string().default("us-east-1"),
  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(200),
  FUSION_QUERIES: z.coerce.number().min(0).max(6).default(3),
  TOP_K_PER_QUERY: z.coerce.number().default(6),
  FINAL_TOP_K: z.coerce.number().default(5),
  MIN_RELEVANCE_SCORE: z.coerce.number().default(0.4),
  VERIFY_GROUNDING: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  MAX_UPLOAD_MB: z.coerce.number().default(15),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
export const env = parsed.data;
