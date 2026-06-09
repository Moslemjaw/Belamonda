import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

const FILES_TO_REMOVE = [
  'replit.nix',
  '.replit',
  'replit.json',
  'tmp-kyc.json',
  'tmp-login-cs.json',
  'tmp-login-customer.json',
  'tmp-login.json',
  'tmp-token.json'
];

const DIRS_TO_REMOVE = [
  '.local',
  '.config'
];

function cleanup() {
  for (const f of FILES_TO_REMOVE) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`Removed file: ${f}`);
    }
  }

  for (const d of DIRS_TO_REMOVE) {
    const p = path.join(ROOT, d);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`Removed directory: ${d}`);
    }
  }

  // Remove any leftover .py files in client and server (excluding node_modules)
  removePyFiles(path.join(ROOT, 'client'));
  removePyFiles(path.join(ROOT, 'server'));
}

function removePyFiles(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules') removePyFiles(fullPath);
    } else if (file.endsWith('.py')) {
      fs.unlinkSync(fullPath);
      console.log(`Removed Python file: ${fullPath}`);
    }
  }
}

cleanup();
