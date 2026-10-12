import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    // Pinecone namespace that holds this organization's vectors (one tenant = one namespace)
    vectorNamespace: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", organizationSchema);
