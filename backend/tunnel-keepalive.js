import { spawn } from 'child_process';
import fetch from 'node-fetch';

let currentUrl = null;

function startTunnel() {
  console.log('Starting SSH tunnel to localhost.run...');
  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-R', '80:localhost:8000',
    'nokey@localhost.run'
  ]);

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[SSH]', output.trim());
    
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life|https:\/\/[a-zA-Z0-9-]+\.localhost\.run/);
    if (match && currentUrl !== match[0]) {
      currentUrl = match[0];
      console.log(`\n\n========================================================`);
      console.log(`>> NEW TUNNEL URL: ${currentUrl}/api/webhook/jira`);
      console.log(`========================================================\n\n`);
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error('[SSH ERROR]', data.toString().trim());
  });

  ssh.on('close', (code) => {
    console.log(`SSH process exited with code ${code}. Restarting in 5s...`);
    currentUrl = null;
    setTimeout(startTunnel, 5000);
  });
}

// Keep it alive by pinging it
setInterval(async () => {
  if (currentUrl) {
    try {
      await fetch(currentUrl + '/api/tickets');
    } catch(e) {}
  }
}, 30000);

startTunnel();
