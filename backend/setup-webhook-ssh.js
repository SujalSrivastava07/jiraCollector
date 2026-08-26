import { spawn } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

(async () => {
  console.log('Starting localhost.run tunnel via SSH...');
  
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-R', '80:localhost:8000',
    'nokey@localhost.run'
  ]);

  let tunnelUrl = null;

  ssh.stdout.on('data', async (data) => {
    const output = data.toString();
    console.log('[SSH]', output.trim());
    
    // Look for URL in output like "tunneled with tls termination, https://abcd.localhost.run"
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life|https:\/\/[a-zA-Z0-9-]+\.localhost\.run/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      console.log(`Tunnel URL obtained: ${tunnelUrl}`);
      
      const webhookUrl = `${tunnelUrl}/api/webhook/jira`;
      
      const payload = {
        url: webhookUrl,
        webhooks: [
          {
            jqlFilter: "labels = genie-ai",
            events: [
              "jira:issue_created",
              "jira:issue_updated",
              "jira:issue_deleted"
            ]
          }
        ]
      };

      console.log('Registering webhook in Jira...');
      const authHeader = `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`;

      try {
        const res = await fetch(`https://${JIRA_DOMAIN}/rest/api/3/webhook`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const resultData = await res.json();
          console.log('Jira Webhook registered successfully:', resultData);
        } else {
          const text = await res.text();
          console.error('Failed to register webhook. Status:', res.status, text);
        }
      } catch (err) {
        console.error('Error calling Jira API:', err);
      }
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error('[SSH ERROR]', data.toString().trim());
  });

  ssh.on('close', (code) => {
    console.log(`SSH process exited with code ${code}`);
  });
})();
