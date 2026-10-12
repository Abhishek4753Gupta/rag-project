import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "../config/env.js";

// Deterministic model for answering / judging
export const answerModel = new ChatGoogleGenerativeAI({
  model: env.GEMINI_CHAT_MODEL,
  apiKey: env.GOOGLE_API_KEY,
  temperature: 0,
  maxRetries: 2,
});

// Slightly more creative model for generating RAG-Fusion query variants
export const queryGenModel = new ChatGoogleGenerativeAI({
  model: env.GEMINI_CHAT_MODEL,
  apiKey: env.GOOGLE_API_KEY,
  temperature: 0.4,
  maxRetries: 2,
});

// Gemini embeddings are asymmetric: use different task types for documents vs. queries.
export const docEmbeddings = new GoogleGenerativeAIEmbeddings({
  model: env.GEMINI_EMBEDDING_MODEL,
  apiKey: env.GOOGLE_API_KEY,
  taskType: "RETRIEVAL_DOCUMENT",
});

export const queryEmbeddings = new GoogleGenerativeAIEmbeddings({
  model: env.GEMINI_EMBEDDING_MODEL,
  apiKey: env.GOOGLE_API_KEY,
  taskType: "RETRIEVAL_QUERY",
});
