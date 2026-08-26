import { z } from 'zod';

// Jira Ticket Domain Models
export const JiraIssueCommentSchema = z.object({
  author: z.string(),
  body: z.string(),
});

export const JiraTicketSchema = z.object({
  issueKey: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  acceptanceCriteria: z.string().optional().nullable(),
  comments: z.array(JiraIssueCommentSchema).default([]),
  linkedIssues: z.array(z.string()).default([]),
});

// Understanding Result Models
export const UnderstandingResultSchema = z.object({
  ticketType: z.enum([
    'bug',
    'feature',
    'refactor',
    'chore',
    'needs_clarification',
    'too_large',
  ]),
  ambiguityScore: z.number().min(1).max(10),
  extractedRequirements: z.array(z.string()),
  filesReferenced: z.array(z.string()).default([]),
  clarificationQuestions: z.array(z.string()).default([]),
});

// Context Search Models
export const FileSnippetSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

export const ContextResultSchema = z.object({
  filesFound: z.array(FileSnippetSchema),
  toolchain: z.any().optional(), // Injected from RepoIndex
});

// Planning & Coding Models
export const ChangePlanSchema = z.object({
  summary: z.string(),
  filesToModify: z.array(z.string()),
  filesToCreate: z.array(z.string()),
  steps: z.array(z.string()),
});

export const CodePatchSchema = z.object({
  patches: z.array(z.object({
    filePath: z.string(),
    newContent: z.string(),
  }))
});
