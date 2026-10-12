import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { env } from "../config/env.js";

const pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
export const getIndex = () => pinecone.index(env.PINECONE_INDEX);

/**
 * Multi-tenancy model:
 *   ONE serverless index, ONE namespace per organization (`org_<orgId>`).
 * Pinecone's own "collections" are index backups, not tenant partitions. Namespaces are the
 * recommended per-tenant isolation primitive: queries are scoped to a single namespace, so an
 * org can never retrieve another org's vectors. We additionally filter on `orgId` metadata
 * (defense in depth).
 */
export const namespaceFor = (orgId) => `org_${orgId}`;

export async function ensureIndex() {
  const { indexes = [] } = await pinecone.listIndexes();
  if (indexes.some((i) => i.name === env.PINECONE_INDEX)) {
    const desc = await pinecone.describeIndex(env.PINECONE_INDEX);
    if (desc.dimension !== env.EMBEDDING_DIM) {
      throw new Error(
        `Pinecone index "${env.PINECONE_INDEX}" has dimension ${desc.dimension} but EMBEDDING_DIM=${env.EMBEDDING_DIM}`
      );
    }
    console.log(`✅ Pinecone index "${env.PINECONE_INDEX}" ready`);
    return;
  }
  console.log(`Creating Pinecone index "${env.PINECONE_INDEX}"…`);
  await pinecone.createIndex({
    name: env.PINECONE_INDEX,
    dimension: env.EMBEDDING_DIM,
    metric: "cosine",
    spec: { serverless: { cloud: env.PINECONE_CLOUD, region: env.PINECONE_REGION } },
    waitUntilReady: true,
  });
  console.log("✅ Pinecone index created");
}

export function storeFor(orgId, embeddings) {
  return new PineconeStore(embeddings, {
    pineconeIndex: getIndex(),
    namespace: namespaceFor(orgId),
  });
}

export const vectorId = (docId, i) => `${docId}_${i}`;

export async function deleteDocumentVectors(orgId, docId, chunkCount) {
  const ns = getIndex().namespace(namespaceFor(orgId));
  const ids = Array.from({ length: chunkCount }, (_, i) => vectorId(docId, i));
  for (let i = 0; i < ids.length; i += 500) {
    await ns.deleteMany(ids.slice(i, i + 500));
  }
}

export async function deleteOrgNamespace(orgId) {
  await getIndex().namespace(namespaceFor(orgId)).deleteAll();
}
