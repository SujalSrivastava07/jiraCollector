import { logger } from '../services/logger.js';

export async function askForClarification(issueKey, questions) {
  logger.info({ issueKey, questions }, 'Clarification Agent activated');

  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!domain || !email || !token) {
    logger.warn('Jira credentials missing. Skipping actual API call.');
    return true; // Mock success
  }

  const commentBody = `Hello! The automated PR agent needs some clarification before proceeding:\n\n` +
    questions.map((q, i) => `${i + 1}. ${q}`).join('\n') +
    `\n\nPlease reply to this comment with answers.`;

  try {
    const url = `https://${domain}/rest/api/3/issue/${issueKey}/comment`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: commentBody }
              ]
            }
          ]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${errText}`);
    }

    logger.info({ issueKey }, 'Successfully posted clarification comment to Jira');
    return true;
  } catch (error) {
    logger.error({ error, issueKey }, 'Failed to post clarification to Jira');
    return false;
  }
}
