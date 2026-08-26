import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import OpenAI from 'openai';
import { RepoConnection, RepoIndex, RepoChunk } from '../models/tenant.js';
import { logger } from './logger.js';
import os from 'os';

const execAsync = util.promisify(exec);

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); 
}

const IGNORED_DIRS = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'];
const IGNORED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.mp4', '.pdf', '.zip'];

/**
 * Basic Indexing Job
 */
export async function indexRepository(tenantId, repoId) {
  logger.info({ tenantId, repoId }, 'Starting indexing job');

  const repoConnection = await RepoConnection.findOne({ tenantId, repoId });
  if (!repoConnection) throw new Error('RepoConnection not found');

  // In a real app, use installation token from Tenant. 
  // For MVP, we use GITHUB_TOKEN or public clone.
  const token = process.env.GITHUB_TOKEN || '';
  const cloneUrl = token 
    ? `https://${token}@github.com/${repoConnection.fullName}.git`
    : `https://github.com/${repoConnection.fullName}.git`;

  const tempDir = path.join(os.tmpdir(), `agent_repo_${repoId}_${Date.now()}`);

  try {
    logger.info(`Cloning repo into ${tempDir}`);
    await execAsync(`git clone --depth 1 --branch ${repoConnection.defaultBranch} ${cloneUrl} ${tempDir}`);

    // Get current SHA
    const { stdout: shaStdout } = await execAsync(`git rev-parse HEAD`, { cwd: tempDir });
    const currentSha = shaStdout.trim();

    logger.info('Parsing and chunking files');
    const files = await walkDir(tempDir);
    const chunksToInsert = [];
    
    // Phase 5: Toolchain Detection
    let detectedToolchain = { hasPackageJson: false, packageManager: null };
    if (files.includes(path.join(tempDir, 'package.json'))) {
      detectedToolchain.hasPackageJson = true;
      if (files.includes(path.join(tempDir, 'yarn.lock'))) detectedToolchain.packageManager = 'yarn';
      else if (files.includes(path.join(tempDir, 'pnpm-lock.yaml'))) detectedToolchain.packageManager = 'pnpm';
      else detectedToolchain.packageManager = 'npm';
    }

    for (const file of files) {
      const relPath = path.relative(tempDir, file);
      const content = await fs.readFile(file, 'utf-8');
      
      // Naive chunking for MVP (split by 1000 characters, respecting lines if possible)
      const chunks = chunkText(content, 1000);
      
      for (let i = 0; i < chunks.length; i++) {
        // Embed chunk
        const embedding = await generateEmbedding(`File: ${relPath}\n\n${chunks[i]}`);
        
        chunksToInsert.push({
          repoId,
          tenantId,
          filePath: relPath,
          chunkIndex: i,
          content: chunks[i],
          embedding
        });
      }
    }

    logger.info(`Storing ${chunksToInsert.length} chunks to vector DB (MongoDB)`);
    // Delete old chunks for this repo
    await RepoChunk.deleteMany({ repoId, tenantId });
    // Insert new chunks
    await RepoChunk.insertMany(chunksToInsert);

    // Update RepoIndex and RepoConnection
    await RepoIndex.findOneAndUpdate(
      { repoId, tenantId },
      { 
        lastUpdated: new Date(),
        detectedToolchain 
      },
      { upsert: true, new: true }
    );

    repoConnection.lastIndexedSha = currentSha;
    await repoConnection.save();

    logger.info({ tenantId, repoId, chunks: chunksToInsert.length }, 'Indexing job complete');
  } catch (error) {
    logger.error({ error, tenantId, repoId }, 'Error during indexing job');
    throw error;
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      logger.warn({ error: e, tempDir }, 'Failed to cleanup temp directory');
    }
  }
}

async function walkDir(dir) {
  let results = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const file of list) {
    if (IGNORED_DIRS.includes(file.name)) continue;
    
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(await walkDir(fullPath));
    } else {
      const ext = path.extname(file.name).toLowerCase();
      if (!IGNORED_EXTS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function chunkText(text, maxLength) {
  const chunks = [];
  let current = 0;
  while (current < text.length) {
    chunks.push(text.slice(current, current + maxLength));
    current += maxLength;
  }
  return chunks;
}

async function generateEmbedding(text) {
  if (!openai) {
    // Return mock 1536-dimensional vector for testing without API key
    return new Array(1536).fill(0).map(() => Math.random());
  }
  
  // Using OpenAI embeddings API
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
