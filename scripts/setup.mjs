#!/usr/bin/env node
/**
 * One-time project setup. Safe to run repeatedly.
 *
 * Output is read by a coding agent. Every failure states the next action.
 */
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const examplePath = join(root, '.env.example');

let failed = false;

// 1. Node version
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`Node ${process.versions.node} is too old. This project needs Node 20.9 or newer.`);
  console.error('Fix: install Node 20 LTS or newer, then run "npm run setup" again.');
  failed = true;
} else {
  console.log(`OK  Node ${process.versions.node}`);
}

// 2. .env exists
if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log('OK  Created .env from .env.example');
} else {
  console.log('OK  .env already exists');
}

// 3. At least one LLM key is filled in
const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const hasKey = /^(ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY)=.+$/m.test(
  envText.replace(/^#.*$/gm, ''),
);

if (!hasKey) {
  console.error('');
  console.error('MISSING  No LLM provider key is set in .env');
  console.error('');
  console.error('Fix: open .env and set ONE of these to a real key:');
  console.error('  ANTHROPIC_API_KEY   https://console.anthropic.com/settings/keys   (recommended)');
  console.error('  OPENAI_API_KEY      https://platform.openai.com/api-keys');
  console.error('  GOOGLE_GENERATIVE_AI_API_KEY   https://aistudio.google.com/apikey');
  console.error('');
  console.error('Semantic recall also uses OPENAI_API_KEY by default. To avoid a second');
  console.error('provider, set EMBEDDING_MODEL to a model from the provider you chose.');
  failed = true;
} else {
  console.log('OK  LLM provider key present');
}

// 4. Storage mode
const tursoSet = /^TURSO_DATABASE_URL=libsql:\/\/.+$/m.test(envText.replace(/^#.*$/gm, ''));
console.log(
  tursoSet
    ? 'OK  Storage: Turso Cloud'
    : 'OK  Storage: local file (file:./mastra.db) — Turso is only needed to deploy',
);

console.log('');
if (failed) {
  console.error('Setup incomplete. Fix the items above, then run "npm run setup" again.');
  process.exit(1);
}

console.log('Setup complete. Next: run "npm run dev", then "npm run verify" in a second shell.');
