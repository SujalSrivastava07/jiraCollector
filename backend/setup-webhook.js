import localtunnel from 'localtunnel';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;

(async () => {
  try {
    console.log('Starting localtunnel...');
    const tunnel = await localtunnel({ port: 8000 });
    const tunnelUrl = tunnel.url;
    console.log(`Tunnel URL obtained: ${tunnelUrl}`);

    const webhookUrl = `${tunnelUrl}/api/webhook/jira`;
    
    // Jira Webhook API payload
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
      const data = await res.json();
      console.log('Jira Webhook registered successfully:', data);
    } else {
      const text = await res.text();
      console.error('Failed to register webhook. Status:', res.status, text);
    }

    console.log('Keeping tunnel open. Press Ctrl+C to exit.');
    
    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

  } catch (err) {
    console.error('Error in setup:', err);
  }
})();
