import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    mimeType: String,
    size: Number,
    hash: { type: String, required: true }, // sha256 of file content – blocks duplicate uploads per org
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
    error: String,
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);
documentSchema.index({ orgId: 1, hash: 1 }, { unique: true });

export const Document = mongoose.model("Document", documentSchema);
