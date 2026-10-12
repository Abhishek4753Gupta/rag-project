import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // direct import avoids pdf-parse's debug-mode bug
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document as LCDocument } from "@langchain/core/documents";
import { env } from "../config/env.js";
import { docEmbeddings } from "./llm.js";
import { storeFor, vectorId } from "./vectorstore.js";
import { AppError } from "../utils/errors.js";

export const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".md"];

const extOf = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();

/** Normalise text extracted from files so chunks are clean and embed well. */
export function cleanText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/-\n(?=[a-z])/g, "") // re-join words hyphenated across line breaks
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Returns [{ text, page }] – page is 1-based for PDFs, 1 for single-flow formats. */
export async function extractPages(buffer, originalName) {
  const ext = extOf(originalName);

  if (ext === ".pdf") {
    const pages = [];
    await pdfParse(buffer, {
      pagerender: async (pageData) => {
        const tc = await pageData.getTextContent({ normalizeWhitespace: true });
        let lastY;
        let text = "";
        for (const item of tc.items) {
          text += lastY === item.transform[5] || lastY === undefined ? item.str : "\n" + item.str;
          lastY = item.transform[5];
        }
        pages.push(text);
        return text;
      },
    });
    return pages.map((text, i) => ({ text: cleanText(text), page: i + 1 })).filter((p) => p.text);
  }

  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ text: cleanText(value), page: 1 }];
  }

  if (ext === ".txt" || ext === ".md") {
    return [{ text: cleanText(buffer.toString("utf8")), page: 1 }];
  }

  throw new AppError(400, `Unsupported file type: ${ext}`);
}

/**
 * Recursive chunking: tries to split on paragraph → line → sentence → clause → word boundaries
 * (in that order) so chunks stay semantically coherent; overlap preserves context across edges.
 */
export function buildSplitter(originalName) {
  const opts = { chunkSize: env.CHUNK_SIZE, chunkOverlap: env.CHUNK_OVERLAP };
  if (extOf(originalName) === ".md") {
    return RecursiveCharacterTextSplitter.fromLanguage("markdown", opts);
  }
  return new RecursiveCharacterTextSplitter({
    ...opts,
    separators: ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
  });
}

export async function chunkDocument({ pages, doc }) {
  const splitter = buildSplitter(doc.originalName);
  const chunks = [];
  for (const { text, page } of pages) {
    const pieces = await splitter.splitText(text);
    for (const piece of pieces) {
      if (piece.trim().length < 30) continue; // drop noise-only fragments
      chunks.push({ text: piece.trim(), page });
    }
  }
  return chunks.map(
    (c, i) =>
      new LCDocument({
        pageContent: c.text,
        // Pinecone metadata must be flat primitives
        metadata: {
          orgId: String(doc.orgId),
          docId: String(doc._id),
          source: doc.originalName,
          page: c.page,
          chunkIndex: i,
        },
      })
  );
}

export async function ingestDocument({ doc, buffer }) {
  const pages = await extractPages(buffer, doc.originalName);
  if (!pages.length) throw new AppError(422, "No extractable text found (scanned PDFs need OCR first).");

  const chunks = await chunkDocument({ pages, doc });
  if (!chunks.length) throw new AppError(422, "Document produced no usable text chunks.");

  const store = storeFor(doc.orgId, docEmbeddings);
  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const ids = batch.map((_, j) => vectorId(doc._id, i + j)); // deterministic ids => idempotent re-ingest
    await store.addDocuments(batch, { ids });
  }
  return { pageCount: pages.length, chunkCount: chunks.length };
}
