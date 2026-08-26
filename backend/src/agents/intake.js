import { logger } from '../services/logger.js';
import { JiraTicketSchema } from '../models/schemas.js';

export function processWebhookPayload(payload) {
  logger.info({ payloadKeys: Object.keys(payload) }, 'Processing raw webhook payload');

  const issue = payload?.issue || {};
  const fields = issue?.fields || {};

  const issueKey = issue?.key || 'UNKNOWN';
  const title = fields?.summary || '';
  let description = fields?.description || '';
  if (typeof description === 'object') {
    description = JSON.stringify(description);
  }
  
  let status = 'Unknown';
  if (fields?.status && typeof fields.status === 'object' && fields.status.name) {
    status = fields.status.name;
  }

  const commentsData = fields?.comment?.comments || [];
  const comments = commentsData.map((c) => {
    let body = c?.body || '';
    if (typeof body === 'object') body = JSON.stringify(body);
    return {
      author: c?.author?.displayName || 'Unknown',
      body,
    };
  });

  const linkedIssues = [];
  const issuelinks = fields?.issuelinks || [];
  for (const link of issuelinks) {
    if (link.outwardIssue?.key) linkedIssues.push(link.outwardIssue.key);
    else if (link.inwardIssue?.key) linkedIssues.push(link.inwardIssue.key);
  }

  const rawTicket = {
    issueKey,
    title,
    description,
    status,
    comments,
    linkedIssues,
  };

  // Validate using Zod to ensure the returned shape is strict
  const ticket = JiraTicketSchema.parse(rawTicket);
  
  logger.info({ issueKey, title }, 'Successfully normalized Jira ticket');
  return ticket;
}
