import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Tenant, RepoConnection, RepoIndex, RepoChunk } from './src/models/tenant.js';
import { indexRepository } from './src/services/indexer.js';

dotenv.config();

const MOCK_TENANT_ID = '64f1b2c3e4d5a6b7c8d9e0f1';
const REPO_ID = '123';
const REPO_FULL_NAME = 'SujalSrivastava07/test-repoforAI';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Ensure Tenant exists
    let tenant = await Tenant.findById(MOCK_TENANT_ID);
    if (!tenant) {
      tenant = new Tenant({ _id: MOCK_TENANT_ID, githubInstallationId: 'mock-github-app' });
      await tenant.save();
      console.log('Created mock Tenant.');
    } else {
      console.log('Mock Tenant already exists.');
    }

    // 2. Ensure RepoConnection exists
    let repo = await RepoConnection.findOne({ tenantId: MOCK_TENANT_ID, repoId: REPO_ID });
    if (!repo) {
      repo = new RepoConnection({
        tenantId: MOCK_TENANT_ID,
        repoId: REPO_ID,
        fullName: REPO_FULL_NAME,
        defaultBranch: 'main'
      });
      await repo.save();
      console.log(`Created mock RepoConnection for ${REPO_FULL_NAME}.`);
    } else {
      console.log(`Mock RepoConnection for ${REPO_FULL_NAME} already exists.`);
    }

    // 3. Trigger Indexing Job
    console.log(`\nStarting indexing job for ${REPO_FULL_NAME}...`);
    await indexRepository(MOCK_TENANT_ID, REPO_ID);
    console.log('\nIndexing completed successfully!');
    
    // Check what was stored
    const chunkCount = await RepoChunk.countDocuments({ tenantId: MOCK_TENANT_ID, repoId: REPO_ID });
    console.log(`\nVerified: ${chunkCount} chunks saved to MongoDB Atlas.`);

  } catch (error) {
    console.error('Failed to run indexer:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

run();
