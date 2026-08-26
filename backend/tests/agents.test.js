import { describe, it, expect, vi } from 'vitest';
import { processWebhookPayload } from '../src/agents/intake.js';
import { analyzeTicket } from '../src/agents/understanding.js';
import { askForClarification } from '../src/agents/clarification.js';
import { gatherContext } from '../src/agents/context.js';
import { createPlan } from '../src/agents/planning.js';
import { writeCode } from '../src/agents/coding.js';
import { validateCode } from '../src/agents/validation.js';
import { openPullRequest } from '../src/agents/pr.js';

// Mock the OpenAI client completely
vi.mock('openai', () => {
  const OpenAIMock = class {
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async (params) => {
          let text = '{}';
          
          const systemMsg = params.messages.find((m) => m.role === 'system')?.content || '';
          
          if (systemMsg.includes('extract structured requirements')) {
            text = JSON.stringify({
              ticketType: 'bug',
              ambiguityScore: 3,
              extractedRequirements: ['Fix Safari login issue'],
              filesReferenced: [],
              clarificationQuestions: []
            });
          } else if (systemMsg.includes('produce a step-by-step implementation plan')) {
            text = JSON.stringify({
              summary: 'Fix login issue in Safari by adding polyfill',
              filesToModify: ['src/login.js'],
              filesToCreate: [],
              steps: ['Add polyfill', 'Test in Safari']
            });
          } else if (systemMsg.includes('write the final code')) {
            text = JSON.stringify({
              patches: [
                {
                  filePath: 'src/login.js',
                  newContent: 'export const login = () => { /* fixed */ };'
                }
              ]
            });
          }

          return {
            choices: [{ message: { content: text } }]
          };
        })
      }
    };
  };
  return { default: OpenAIMock };
});

describe('Agents', () => {
  it('Intake Agent - normalizes Jira webhook payload', () => {
    const mockPayload = {
      issue: {
        key: 'PROJ-123',
        fields: {
          summary: 'Fix login bug',
          description: 'Users cannot login when using Safari.',
          status: { name: 'To Do' },
          comment: {
            comments: [
              { author: { displayName: 'Alice' }, body: "It's urgent." }
            ]
          }
        }
      }
    };

    const ticket = processWebhookPayload(mockPayload);
    
    expect(ticket.issueKey).toBe('PROJ-123');
    expect(ticket.title).toBe('Fix login bug');
    expect(ticket.status).toBe('To Do');
    expect(ticket.comments.length).toBe(1);
    expect(ticket.comments[0].author).toBe('Alice');
  });

  it('Understanding Agent - parses LLM JSON successfully', async () => {
    const ticket = {
      issueKey: 'PROJ-123',
      title: 'Fix login bug',
      description: 'Users cannot login when using Safari.',
      status: 'To Do',
      comments: [],
      linkedIssues: []
    };

    const result = await analyzeTicket(ticket);
    
    expect(result.ticketType).toBe('bug');
    expect(result.ambiguityScore).toBe(3);
    expect(result.extractedRequirements).toContain('Fix Safari login issue');
  });

  it('Clarification Agent - mocks successful API call', async () => {
    // Override fetch globally for this test
    const globalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const success = await askForClarification('PROJ-123', ['What version of Safari?']);
    expect(success).toBe(true);

    // Restore fetch
    global.fetch = globalFetch;
  });

  it('Context Agent - searches local directory and returns Zod validated object', async () => {
    // For unit tests, we'll just ensure the function doesn't crash on an empty/missing dummy repo
    const result = await gatherContext(['non_existent_file.js'], ['login']);
    expect(result.filesFound).toBeInstanceOf(Array);
  });

  it('Planning Agent - parses LLM JSON to ChangePlan successfully', async () => {
    const ticket = processWebhookPayload({ issue: { key: 'PROJ-1' } });
    const understanding = { ticketType: 'bug', ambiguityScore: 1, extractedRequirements: [], filesReferenced: [], clarificationQuestions: [] };
    const context = { filesFound: [] };

    const plan = await createPlan(ticket, understanding, context);
    expect(plan.summary).toBe('Fix login issue in Safari by adding polyfill');
    expect(plan.filesToModify).toContain('src/login.js');
  });

  it('Coding Agent - parses LLM JSON to CodePatch successfully', async () => {
    const ticket = processWebhookPayload({ issue: { key: 'PROJ-1' } });
    const plan = { summary: '', filesToModify: [], filesToCreate: [], steps: [] };
    const context = { filesFound: [] };

    const patch = await writeCode(ticket, plan, context);
    expect(patch.patches.length).toBe(1);
    expect(patch.patches[0].filePath).toBe('src/login.js');
    expect(patch.patches[0].newContent).toContain('fixed');
  });

  it('Validation Agent - runs local command', async () => {
    const isValid = await validateCode('PROJ-123');
    expect(typeof isValid).toBe('boolean');
  });

  it('PR Agent - mocks PR URL when credentials are missing', async () => {
    const mockPlan = {
      summary: 'Test summary',
      filesToModify: [],
      filesToCreate: [],
      steps: []
    };
    const mockPatch = {
      patches: []
    };
    const prUrl = await openPullRequest('TEST-1', mockPlan, true, mockPatch);
    expect(prUrl).toMatch(/github\.com\/mock-org/);
  });
});
