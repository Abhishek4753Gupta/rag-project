# Marginalia — multi-tenant RAG knowledge base

MERN + **LangChain.js** + **Pinecone** + **Gemini**. Organizations register themselves, admins upload documents,
and everyone in the organization asks questions and gets cited, grounded answers.

## Quick start

Prerequisites: Node 18.18+ (20 recommended), a MongoDB instance (local or Atlas), a [Gemini API key](https://aistudio.google.com/apikey), a [Pinecone API key](https://app.pinecone.io).

```bash
npm run install:all                 # installs root, server and client deps
cp server/.env.example server/.env  # then fill in your keys
npm run dev                         # API on :5000, web app on :5173
```

On first start the server creates the Pinecone serverless index (dimension must equal `EMBEDDING_DIM`, default 3072 for `gemini-embedding-001`).
Open http://localhost:5173 → **Register your organization** → you land on the admin home → upload a PDF/DOCX/MD/TXT → wait for *Ready* → ask questions.

## How the requirements map to the code

| Requirement | Where |
|---|---|
| Role-based login, different home for admins vs users | `client/src/App.jsx` (`/admin` vs `/app`), `components/ProtectedRoute.jsx`, `server/src/middleware/auth.js` (`requireRole`) |
| Only admins can upload | `server/src/routes/admin.routes.js` — the whole router is behind `requireRole("admin")` |
| Public landing page with "Register your organization" | `client/src/pages/Landing.jsx` → `POST /api/auth/register-organization` |
| Separate vector space per organization | `server/src/services/vectorstore.js` — one Pinecone **namespace** per org (`org_<orgId>`) |
| JWT containing organization id | `signToken()` → claims `sub`, `role`, `orgId` |
| MongoDB users/admins with org id | `server/src/models/User.js`, `Organization.js` |
| Recursive chunking | `server/src/services/ingest.js` (`RecursiveCharacterTextSplitter`) |
| RAG-Fusion | `server/src/services/rag.js` (query variants + Reciprocal Rank Fusion) |
| Grounding constraints | strict prompt, relevance gate, citations, post-hoc verifier (see below) |

### A note on "collections"
Pinecone's *collections* are static index backups, not tenant partitions. The recommended multi-tenancy pattern is
**one index, one namespace per tenant**, which is what this project does. Queries are executed inside a single namespace and
also carry an `orgId` metadata filter, so cross-tenant retrieval is impossible even if one layer had a bug.
Namespaces are created automatically on the first upsert. (If you truly need an index per org, change `storeFor()` / `getIndex()`.)

## The RAG pipeline

```
question (+ last ≤6 turns)
  1. condense follow-ups into a standalone question
  2. RAG-Fusion: LLM writes N query variants (original is always kept)
  3. parallel vector search in the org's namespace (top-K per variant, cosine)
  4. relevance gate: drop chunks below MIN_RELEVANCE_SCORE
  5. Reciprocal Rank Fusion (k=60) → best FINAL_TOP_K unique chunks
  6. if nothing survives → "not found" WITHOUT calling the LLM
  7. answer with a grounded prompt; numbered passages, mandatory [n] citations
  8. verifier pass: is every claim supported by the context? if not → "not found"
  9. return answer + only the sources actually cited (file, page, snippet)
```

Good practices included:
- **Recursive chunking** (1000 chars / 200 overlap; paragraph → line → sentence → clause → word) with Markdown-aware splitting for `.md`; PDF pages are chunked separately so each chunk keeps its **page number**.
- **Asymmetric embeddings**: `RETRIEVAL_DOCUMENT` for ingestion, `RETRIEVAL_QUERY` for search.
- **Deterministic vector ids** (`<docId>_<n>`) → re-ingestion is idempotent and deletion is exact.
- **Duplicate-file protection** (sha256 per org), text cleaning, tiny-chunk filtering, batched embedding.
- **Anti-hallucination**: temperature 0, "use only the context" prompt, refusal string, similarity floor, citation requirement, verifier, and no LLM call when nothing relevant is found.
- **Prompt-injection hardening**: retrieved text and questions are declared untrusted data in the system prompt.
- **Graceful degradation**: if query expansion or verification fails, the pipeline falls back instead of erroring.
- **Observability for admins**: *Activity* tab lists questions and flags the ones that couldn't be answered (= gaps in your documents).

Tuning knobs (all in `.env`): `CHUNK_SIZE`, `CHUNK_OVERLAP`, `FUSION_QUERIES`, `TOP_K_PER_QUERY`, `FINAL_TOP_K`, `MIN_RELEVANCE_SCORE`, `VERIFY_GROUNDING`.
`MIN_RELEVANCE_SCORE` is corpus-dependent: if good questions get "not found", lower it (e.g. 0.3); if off-topic questions get answers, raise it.

## Security notes
- Passwords: bcrypt (cost 12). JWT: signed HS256, expires in `JWT_EXPIRES_IN`, carries `sub`, `role`, `orgId`.
- On **every** request the user is re-loaded from MongoDB and the token's `orgId` must match, so removed users lose access immediately.
- The organization id used for queries/uploads always comes from the verified token — never from the request body.
- Helmet, CORS allow-list, request size limit, Zod validation, rate limits (auth: 30/15 min per IP; chat: 20/min per user), uploads limited by type and size (kept in memory, never written to disk).
- Login errors are generic to avoid account enumeration. Emails are globally unique.
- The client stores the JWT in `localStorage` for simplicity. For stricter XSS protection, switch to an httpOnly cookie.

## API summary

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register-organization` | public | create org + first admin |
| POST | `/api/auth/login` | public | sign in |
| GET | `/api/auth/me` | any | current user |
| GET | `/api/chat/documents` | any | names of ready documents |
| POST | `/api/chat` | any | ask a question `{question, history[]}` |
| GET/POST/DELETE | `/api/admin/documents[/:id]` | admin | list / upload / delete documents |
| GET/POST/DELETE | `/api/admin/users[/:id]` | admin | manage org members |
| GET | `/api/admin/activity` | admin | recent questions + stats |

## Production checklist
- Put the API behind HTTPS, set a strong `JWT_SECRET`, restrict `CLIENT_ORIGIN`.
- Move ingestion to a job queue (BullMQ) if you expect large files or many uploads; it currently runs in-process after the 202 response.
- Add OCR for scanned PDFs, hybrid (sparse + dense) search or a reranker for even better recall/precision.
- Add email-based invites / password reset instead of admin-set temporary passwords.
