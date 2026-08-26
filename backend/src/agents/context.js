import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { logger } from '../services/logger.js';
import { ContextResultSchema } from '../models/schemas.js';
import { RepoChunk, RepoIndex } from '../models/tenant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_REPO_PATH = process.env.TARGET_REPO_PATH || path.join(__dirname, '../../dummy_repo');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Fallback legacy local file walk (MVP)
function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') filelist = walkSync(filepath, filelist);
    } else {
      filelist.push(filepath);
    }
  }
  return filelist;
}

export async function gatherContext(filesReferenced, keywords, tenantId = null, repoId = null) {
  logger.info({ filesReferenced, keywords, tenantId, repoId }, 'Context Agent activated');
  const foundSnippets = [];
  let toolchain = null;

  if (tenantId) {
    try {
      // 1. Fetch RepoIndex to get toolchain
      if (repoId) {
        const repoIndex = await RepoIndex.findOne({ repoId, tenantId });
        if (repoIndex) toolchain = repoIndex.detectedToolchain;
      }

      let queryEmbedding = null;
      if (openai) {
        const queryText = keywords.join('\n');
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: queryText,
        });
        queryEmbedding = response.data[0].embedding;
      } else {
        // Fallback mock embedding
        queryEmbedding = new Array(1536).fill(0).map(() => Math.random());
      }

      // 3. Query MongoDB Vector Search
      const searchResults = await RepoChunk.aggregate([
        {
          $vectorSearch: {
            index: "vector_index", // The name of the Atlas search index
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 10,
            filter: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              ...(repoId && { repoId })
            }
          }
        },
        {
          $project: {
            _id: 0,
            filePath: 1,
            content: 1,
            score: { $meta: "vectorSearchScore" }
          }
        }
      ]);

      for (const res of searchResults) {
        foundSnippets.push({
          filePath: res.filePath,
          content: res.content // already chunked in DB
        });
      }
      logger.info({ count: searchResults.length }, 'Retrieved vector search results');

    } catch (err) {
      logger.error({ err }, 'Vector search failed, falling back to local grep');
    }
  }

  // Fallback to local disk if no tenantId or vector search returned nothing
  if (foundSnippets.length === 0) {
    const allFiles = walkSync(TARGET_REPO_PATH);
    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      const isMentioned = filesReferenced.some(ref => fileName.includes(ref) || filePath.includes(ref));
      if (isMentioned) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          foundSnippets.push({
            filePath: path.relative(TARGET_REPO_PATH, filePath),
            content: content.slice(0, 5000) // Truncate for MVP sanity
          });
        } catch (err) {
          logger.error({ filePath, err }, 'Error reading file');
        }
      }
    }
  }

  const result = ContextResultSchema.parse({ filesFound: foundSnippets, toolchain });
  logger.info({ count: result.filesFound.length }, 'Context gathering complete');
  
  return result;
}
