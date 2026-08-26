import fetch from 'node-fetch';

const mockWebhook = {
  webhookEvent: 'jira:issue_created',
  issue: {
    key: 'KAN-42',
    fields: {
      labels: ['genie-ai'],
      summary: 'Fix the typo in the welcome message',
      description: 'The welcome message says "Welcme", it should say "Welcome"'
    }
  },
  comments: []
};

(async () => {
  try {
    console.log('Sending mock Jira webhook to local server...');
    const res = await fetch('http://localhost:8000/api/webhook/jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockWebhook)
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('Pipeline Output:', JSON.stringify(data, null, 2));
    } else {
      console.error('Server error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
})();
