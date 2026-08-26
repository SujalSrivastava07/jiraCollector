import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_REPO_PATH = process.env.TARGET_REPO_PATH || path.join(__dirname, '../../../dummy_repo');

export async function validateCode(issueKey) {
  logger.info({ issueKey }, 'Validation Agent activated');

  return new Promise((resolve) => {
    // For MVP, we'll run a simple syntax check using node if it's a JS/TS file, 
    // or just a mock command if the repo has no tests. 
    // In a real system, this would be 'npm test' or similar.
    const cmd = process.platform === 'win32' ? 'dir' : 'ls -la';
    
    logger.debug(`Running validation command: ${cmd} in ${TARGET_REPO_PATH}`);

    exec(cmd, { cwd: TARGET_REPO_PATH }, (error, stdout, stderr) => {
      if (error) {
        logger.error({ issueKey, error: error.message, stderr }, 'Validation failed');
        resolve(false);
      } else {
        logger.info({ issueKey, stdout: stdout.slice(0, 100) }, 'Validation passed');
        resolve(true);
      }
    });
  });
}
