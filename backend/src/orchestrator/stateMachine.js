import { logger } from '../services/logger.js';
import { processWebhookPayload } from '../agents/intake.js';
import { analyzeTicket } from '../agents/understanding.js';
import { askForClarification } from '../agents/clarification.js';
import { gatherContext } from '../agents/context.js';
import { createPlan } from '../agents/planning.js';
import { writeCode } from '../agents/coding.js';
import { validateCode } from '../agents/validation.js';
import { openPullRequest } from '../agents/pr.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Orchestrator {
  constructor(githubConfig, ticket = null) {
    this.githubConfig = githubConfig;
    this.ticket = ticket;
    this.state = 'IDLE';
    
    this.stages = [
      { id: "intake", label: "Intake", status: "pending" },
      { id: "understanding", label: "Understanding", status: "pending" },
      { id: "clarification", label: "Clarification", status: "pending" },
      { id: "context", label: "Context", status: "pending" },
      { id: "planning", label: "Planning", status: "pending" },
      { id: "coding", label: "Coding", status: "pending" },
      { id: "validation", label: "Validation", status: "pending" },
      { id: "reviewer", label: "Reviewer", status: "pending" },
      { id: "pr", label: "Open PR", status: "pending" },
      { id: "review", label: "Client Review", status: "pending" }
    ];
    
    if (this.ticket) {
      this.ticket.stages = this.stages;
      this.ticket.currentStage = 'intake';
    }

    this.currentTicket = null;
    this.understanding = null;
    this.context = null;
    this.plan = null;
    this.patch = null;
  }

  updateStage(stageId, updates) {
    const stage = this.stages.find(s => s.id === stageId);
    if (stage) {
      Object.assign(stage, updates);
    }
    if (this.ticket) {
      this.ticket.stages = [...this.stages];
      if (updates.status === 'running') {
        this.ticket.currentStage = stageId;
      }
    }
  }

  async handleJiraWebhook(payload) {
    logger.info('Orchestrator started pipeline');
    
    try {
      // Step 1: Intake
      this.state = 'INTAKE';
      this.updateStage('intake', { status: 'running', startedAt: Date.now() });
      this.currentTicket = processWebhookPayload(payload);
      this.updateStage('intake', { status: 'complete', finishedAt: Date.now() });
      
      // Step 2: Understanding
      this.state = 'UNDERSTANDING';
      this.updateStage('understanding', { status: 'running', startedAt: Date.now() });
      this.understanding = await analyzeTicket(this.currentTicket);
      this.updateStage('understanding', { status: 'complete', finishedAt: Date.now() });
      
      // Step 3: Branching
      if (this.understanding.ambiguityScore >= 8) {
        this.state = 'CLARIFICATION_NEEDED';
        this.updateStage('clarification', { status: 'running', startedAt: Date.now() });
        logger.warn({ questions: this.understanding.clarificationQuestions }, 'Ticket is too ambiguous. Clarification Agent taking over.');
        
        await askForClarification(this.currentTicket.issueKey, this.understanding.clarificationQuestions);
        this.updateStage('clarification', { status: 'complete', finishedAt: Date.now() });
        
        // Skip remaining stages
        ['context', 'planning', 'coding', 'validation', 'reviewer', 'pr', 'review'].forEach(s => this.updateStage(s, { status: 'skipped' }));
        
        return {
          status: 'clarification_needed',
          ticketKey: this.currentTicket.issueKey,
          questions: this.understanding.clarificationQuestions,
        };
      }
      
      this.updateStage('clarification', { status: 'skipped' });
      
      // Step 4: Context Gathering
      this.state = 'GATHERING_CONTEXT';
      this.updateStage('context', { status: 'running', startedAt: Date.now() });
      logger.info('Ticket is clear enough. Activating Context Agent.');
      
      this.context = await gatherContext(
        this.understanding.filesReferenced,
        this.understanding.extractedRequirements,
        this.githubConfig.tenantId,
        this.githubConfig.repoId
      );
      
      this.state = 'READY_FOR_PLANNING';
      this.updateStage('context', { status: 'complete', finishedAt: Date.now() });
      logger.info({ ticketKey: this.currentTicket.issueKey, filesFound: this.context.filesFound.length }, 'Context gathered. Activating Planning Agent.');

      // Step 5: Planning
      this.state = 'PLANNING';
      this.updateStage('planning', { status: 'running', startedAt: Date.now() });
      this.plan = await createPlan(this.currentTicket, this.understanding, this.context);
      this.updateStage('planning', { status: 'complete', finishedAt: Date.now() });
      
      // Step 6: Coding
      this.state = 'CODING';
      this.updateStage('coding', { status: 'running', startedAt: Date.now() });
      logger.info('Plan created. Activating Coding Agent.');
      this.patch = await writeCode(this.currentTicket, this.plan, this.context);
      this.updateStage('coding', { status: 'complete', finishedAt: Date.now() });

      // Step 7: Apply to Disk
      this.state = 'APPLYING_PATCHES';
      const TARGET_REPO_PATH = process.env.TARGET_REPO_PATH || path.join(__dirname, '../../../dummy_repo');
      
      for (const p of this.patch.patches) {
        const fullPath = path.join(TARGET_REPO_PATH, p.filePath);
        // Ensure directory exists
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, p.newContent);
        logger.debug({ filePath: p.filePath }, 'Wrote patched file to disk');
      }

      this.state = 'VALIDATING';
      this.updateStage('validation', { status: 'running', startedAt: Date.now() });
      logger.info('Patches applied successfully. Activating Validation Agent.');
      
      // Step 8: Validation
      const isValid = await validateCode(this.currentTicket.issueKey);
      if (!isValid) {
        logger.warn({ ticketKey: this.currentTicket.issueKey }, 'Validation failed. In a full system, this would loop back to Coding.');
      }
      this.updateStage('validation', { status: 'complete', finishedAt: Date.now() });

      // Step 8b: Reviewer
      this.updateStage('reviewer', { status: 'running', startedAt: Date.now() });
      // Simulate reviewer
      await new Promise(r => setTimeout(r, 1000));
      this.updateStage('reviewer', { status: 'complete', finishedAt: Date.now() });

      // Step 9: Pull Request
      this.state = 'OPENING_PR';
      this.updateStage('pr', { status: 'running', startedAt: Date.now() });
      logger.info('Activating PR Agent.');
      const prUrl = await openPullRequest(this.currentTicket.issueKey, this.plan, isValid, this.patch, this.githubConfig);
      this.updateStage('pr', { status: 'complete', finishedAt: Date.now() });

      this.state = 'COMPLETE';
      this.updateStage('review', { status: 'running', startedAt: Date.now() }); // Client review is now the active holding state
      logger.info({ prUrl }, 'Pipeline finished successfully.');

      return {
        status: 'success',
        ticketKey: this.currentTicket.issueKey,
        understanding: this.understanding,
        context: this.context,
        plan: this.plan,
        patch: this.patch,
        prUrl
      };

    } catch (error) {
      logger.error({ state: this.state, error: error.message }, 'Pipeline failed');
      this.state = 'ERROR';
      
      // Mark current running stage as failed
      if (this.ticket && this.ticket.currentStage) {
        this.updateStage(this.ticket.currentStage, { status: 'failed', finishedAt: Date.now(), error: error.message });
      }
      
      return { status: 'error', message: error.message };
    }
  }
}
