import { ProjectMapping, RepoConnection } from '../models/tenant.js';
import { logger } from './logger.js';

export class TenantResolver {
  /**
   * Resolves the repositories mapped to a Jira ticket key.
   * @param {string} issueKey e.g. "PROJ-123"
   * @returns {Promise<{ tenantId: string, repos: any[] }>}
   */
  static async resolveReposForJiraTicket(issueKey) {
    if (!issueKey) {
      throw new Error("Missing issue key");
    }
    
    // Extract project key (e.g., "PROJ" from "PROJ-123")
    const projectKey = issueKey.split('-')[0];
    
    // Find mapping
    const mapping = await ProjectMapping.findOne({ jiraProjectKey: projectKey });
    if (!mapping) {
      logger.warn({ projectKey }, 'No project mapping found for Jira project');
      return { tenantId: null, repos: [] };
    }
    
    // Find all connected repos
    const repos = await RepoConnection.find({ 
      tenantId: mapping.tenantId, 
      repoId: { $in: mapping.repoIds } 
    });
    
    return {
      tenantId: mapping.tenantId,
      repos
    };
  }
}
