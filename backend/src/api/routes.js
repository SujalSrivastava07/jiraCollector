import { Router } from 'express';
import { Orchestrator } from '../orchestrator/stateMachine.js';
import { logger } from '../services/logger.js';
import { ProjectMapping, RepoConnection } from '../models/tenant.js';
import { TenantResolver } from '../services/tenantResolver.js';
import { requireAuth } from '../middleware/auth.js';

// In-memory store for MVP frontend
// History cleared on restart
const ticketHistory = [];

export let githubConfig = {
  owner: process.env.GITHUB_OWNER || '',
  repo: process.env.GITHUB_REPO || '',
  token: process.env.GITHUB_TOKEN || ''
};

export const router = Router();

// --- Multi-Tenant Onboarding Routes ---

router.get('/mappings/:tenantId', requireAuth, async (req, res) => {
  try {
    const mappings = await ProjectMapping.find({ tenantId: req.params.tenantId });
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

router.post('/mappings', requireAuth, async (req, res) => {
  try {
    const { tenantId, jiraProjectKey, repoIds } = req.body;
    let mapping = await ProjectMapping.findOne({ tenantId, jiraProjectKey });
    if (mapping) {
      return res.status(409).json({ error: `Jira key '${jiraProjectKey}' is already mapped to repo ID: ${mapping.repoIds[0]}. Please delete the existing mapping first.` });
    }
    mapping = new ProjectMapping({ tenantId, jiraProjectKey, repoIds });
    await mapping.save();
    res.json({ message: 'Mapping saved successfully', mapping });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save mapping' });
  }
});

router.delete('/mappings/:id', requireAuth, async (req, res) => {
  try {
    await ProjectMapping.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

router.get('/repos/:tenantId', requireAuth, async (req, res) => {
  try {
    const repos = await RepoConnection.find({ tenantId: req.params.tenantId });
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

router.post('/repos', requireAuth, async (req, res) => {
  try {
    const { tenantId, repoId, fullName, defaultBranch } = req.body;
    let repo = await RepoConnection.findOne({ tenantId, repoId });
    if (!repo) {
      repo = new RepoConnection({ tenantId, repoId, fullName, defaultBranch });
      await repo.save();
    }
    res.json({ message: 'Repo connected successfully', repo });
  } catch (error) {
    logger.error({ error }, 'Failed to connect repo');
    res.status(500).json({ error: 'Failed to connect repo' });
  }
});

// -------------------------------------

router.post('/webhook/jira', async (req, res) => {
  try {
    const payload = req.body;
    logger.info({ event: payload.webhookEvent }, 'Received Jira webhook');

    // Handle ticket deletion
    if (payload.webhookEvent === 'jira:issue_deleted') {
      const deletedKey = payload.issue?.key;
      if (deletedKey) {
        // Remove all instances of this ticket from history
        const initialLength = ticketHistory.length;
        for (let i = ticketHistory.length - 1; i >= 0; i--) {
          if (ticketHistory[i].ticketKey === deletedKey) {
            ticketHistory.splice(i, 1);
          }
        }
        logger.info({ ticketKey: deletedKey, removed: initialLength - ticketHistory.length }, 'Removed deleted ticket from frontend history');
      }
      return res.json({ message: 'Ticket deleted successfully' });
    }

    // Filter: Only process tickets labeled with 'genie-ai'
    const labels = payload.issue?.fields?.labels || [];
    if (!labels.includes('genie-ai')) {
      logger.info({ issueKey: payload.issue?.key, labels }, 'Ignoring Jira webhook: Missing genie-ai label');
      return res.json({ message: 'Ignored: Ticket does not have the genie-ai label' });
    }

    const { tenantId, repos } = await TenantResolver.resolveReposForJiraTicket(payload.issue?.key);
    
    if (!tenantId || repos.length === 0) {
      logger.warn({ issueKey: payload.issue?.key }, 'No mapped repos found, falling back to default githubConfig (legacy MVP behavior)');
    }

    // For now, if we have dynamic repos, we use the first one mapped. 
    // Otherwise fallback to the globally configured githubConfig
    let activeConfig = githubConfig;
    if (repos && repos.length > 0) {
      const parts = repos[0].fullName.split('/');
      activeConfig = {
        owner: parts[0],
        repo: parts[1],
        token: process.env.GITHUB_TOKEN || '', // Ideally from Tenant document
        tenantId, // pass tenantId so Context Agent knows where to query vector DB
        repoId: repos[0].repoId // pass repoId to look up RepoIndex toolchain
      };
    }

    const ticketId = Date.now().toString();
    const newTicket = {
      id: ticketId,
      timestamp: new Date().toISOString(),
      ticketKey: payload.issue?.key,
      status: 'WAITING', // Show waiting state
      understanding: { extractedRequirements: ['Waiting for user to start agent pipeline...'] },
      _rawPayload: payload,
      _activeConfig: activeConfig
    };
    
    // Add instantly so it shows on the UI immediately
    ticketHistory.unshift(newTicket);
    
    res.json({ message: 'Webhook received, waiting for manual start', ticketId });
  } catch (error) {
    logger.error({ error }, 'Error in Jira webhook route');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// New endpoint to manually start the pipeline
router.post('/tickets/:id/start', requireAuth, async (req, res) => {
  const ticket = ticketHistory.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  if (ticket.status !== 'WAITING') {
    return res.status(400).json({ error: 'Ticket is already processing or completed' });
  }
  
  // Update state to INTAKE
  ticket.status = 'INTAKE';
  ticket.understanding = { extractedRequirements: ['Processing ticket...'] };
  
  // Run orchestrator asynchronously
  const orchestrator = new Orchestrator(ticket._activeConfig, ticket);
  orchestrator.handleJiraWebhook(ticket._rawPayload)
    .then(result => {
      Object.assign(ticket, result);
    })
    .catch(err => {
      logger.error({ err }, 'Error in orchestrator pipeline');
      ticket.status = 'error';
      ticket.message = err.message;
    });
    
  res.json({ message: 'Pipeline started successfully' });
});

router.get('/tickets', requireAuth, (req, res) => {
  res.status(200).json(ticketHistory);
});

router.delete('/tickets/:id', requireAuth, (req, res) => {
  const index = ticketHistory.findIndex(t => t.id === req.params.id);
  if (index !== -1) {
    ticketHistory.splice(index, 1);
    return res.json({ message: 'Ticket dismissed' });
  }
  return res.status(404).json({ error: 'Ticket not found' });
});

router.get('/config', requireAuth, (req, res) => {
  // Never send the raw token to the frontend securely, but for MVP it's okay,
  // or we can just send owner/repo. Let's send it all so the UI can display it.
  res.status(200).json(githubConfig);
});

router.post('/config', requireAuth, (req, res) => {
  const { owner, repo, token } = req.body;
  if (owner !== undefined) githubConfig.owner = owner;
  if (repo !== undefined) githubConfig.repo = repo;
  if (token !== undefined && token !== '') githubConfig.token = token;
  
  logger.info({ owner: githubConfig.owner, repo: githubConfig.repo }, 'Updated GitHub configuration');
  res.status(200).json({ message: 'Configuration updated', config: githubConfig });
});

import { indexRepository } from '../services/indexer.js';

router.post('/webhook/github', async (req, res) => {
  try {
    const payload = req.body;
    const event = req.headers['x-github-event'];
    
    logger.info({ event }, 'Received GitHub webhook');

    if (event === 'push') {
      const fullName = payload.repository?.full_name;
      if (!fullName) {
        return res.status(400).json({ error: 'Missing repository full_name' });
      }

      // Find the RepoConnection by fullName
      const repoConnection = await RepoConnection.findOne({ fullName });
      if (!repoConnection) {
        logger.info({ fullName }, 'Ignoring push event for untracked repository');
        return res.json({ message: 'Untracked repository ignored' });
      }

      // Background indexing job
      indexRepository(repoConnection.tenantId, repoConnection.repoId)
        .catch(err => logger.error({ err }, 'Background indexing failed'));
      
      return res.json({ message: 'Indexing job triggered' });
    }

    res.json({ message: 'Webhook received' });
  } catch (error) {
    logger.error({ error }, 'Error processing GitHub webhook');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
