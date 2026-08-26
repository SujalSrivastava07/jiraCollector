import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  githubInstallationId: {
    type: String,
    required: false, // Populated after GitHub connect
  },
  jiraCloudId: {
    type: String,
    required: false, // Populated after Jira connect
  },
  jiraAccessToken: {
    type: String,
    required: false,
  },
  jiraRefreshToken: {
    type: String,
    required: false,
  }
}, { timestamps: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);

const repoConnectionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  repoId: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true // e.g. "org/repo"
  },
  defaultBranch: {
    type: String,
    default: 'main'
  },
  lastIndexedSha: {
    type: String
  }
}, { timestamps: true });

export const RepoConnection = mongoose.model('RepoConnection', repoConnectionSchema);

const projectMappingSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  jiraProjectKey: {
    type: String,
    required: true
  },
  repoIds: [{
    type: String // Corresponds to repoId in RepoConnection
  }]
}, { timestamps: true });

export const ProjectMapping = mongoose.model('ProjectMapping', projectMappingSchema);

const repoIndexSchema = new mongoose.Schema({
  repoId: {
    type: String,
    required: true,
    unique: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  symbolTableRef: {
    type: String
  },
  vectorIndexRef: {
    type: String
  },
  dependencyGraphRef: {
    type: String
  },
  detectedToolchain: {
    type: mongoose.Schema.Types.Mixed
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export const RepoIndex = mongoose.model('RepoIndex', repoIndexSchema);

const repoChunkSchema = new mongoose.Schema({
  repoId: { type: String, required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  filePath: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }, // For Atlas Vector Search
});

export const RepoChunk = mongoose.model('RepoChunk', repoChunkSchema);
