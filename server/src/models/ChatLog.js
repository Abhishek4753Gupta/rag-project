import mongoose from "mongoose";

const chatLogSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    question: String,
    answer: String,
    grounded: Boolean,
    sourceCount: Number,
    latencyMs: Number,
  },
  { timestamps: true }
);

export const ChatLog = mongoose.model("ChatLog", chatLogSchema);
