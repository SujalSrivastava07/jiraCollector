import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing Jira credentials in .env");
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`;
const processedTickets = new Set(); // Keep track so we don't process twice

async function pollJira() {
  console.log('Polling Jira for new genie-ai tickets...');
  try {
    // Search for tickets with label 'genie-ai'
    const res = await fetch(`https://${JIRA_DOMAIN}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jql: 'labels = "genie-ai" ORDER BY created DESC',
        maxResults: 10,
        fields: ["summary", "description", "labels"]
      })
    });

    if (res.ok) {
      const data = await res.json();
      for (const issue of data.issues) {
        if (!processedTickets.has(issue.key)) {
          console.log(`[Poller] Found new ticket: ${issue.key} - ${issue.fields?.summary || 'No Summary'}`);
          processedTickets.add(issue.key);

          // Simulate the webhook payload that Jira would have sent
          const mockWebhook = {
            webhookEvent: 'jira:issue_created',
            issue: {
              key: issue.key,
              fields: {
                labels: issue.fields?.labels || [],
                summary: issue.fields?.summary || '',
                description: issue.fields?.description?.content?.[0]?.content?.[0]?.text || 'No description provided'
              }
            }
          };

          // Send to our local backend
          try {
            await fetch('http://localhost:8000/api/webhook/jira', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mockWebhook)
            });
            console.log(`[Poller] Sent ${issue.key} to local backend successfully.`);
          } catch (err) {
            console.error(`[Poller] Failed to send ${issue.key} to backend`, err);
          }
        }
      }
    } else {
      console.error(`Jira API error: ${res.status}`, await res.text());
    }
  } catch (err) {
    console.error('Polling error:', err);
  }
}

// Poll every 5 seconds
setInterval(pollJira, 5000);
pollJira(); // run immediately
