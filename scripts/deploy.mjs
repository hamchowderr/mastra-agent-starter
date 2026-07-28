#!/usr/bin/env node
/**
 * Build, then deploy the prebuilt output to Vercel.
 *
 * Why this is a script and not `mastra build && vercel deploy --prod`:
 *
 * The Mastra Vercel deployer emits Build Output API v3 into
 * `.mastra/.vercel/output`, NOT `.vercel/output` at the project root. Running
 * `vercel deploy` from the root therefore does not see the prebuilt output — it
 * would upload the source and rebuild on Vercel, ignoring everything
 * `mastra build` produced (including maxDuration from the deployer config).
 *
 * So: locate the directory that CONTAINS `.vercel/output`, and run
 * `vercel deploy --prebuilt` from there.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prod = !process.argv.includes('--preview');

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  return res.status ?? 1;
}

// 1. Build
console.log('> mastra build');
if (run('npx', ['mastra', 'build'], root) !== 0) {
  console.error('\nFAIL  Build failed. Fix the errors above before deploying.');
  process.exitCode = 1;
} else {
  // 2. Find the directory containing .vercel/output
  const candidates = [join(root, '.mastra'), root];
  const outputRoot = candidates.find((d) => existsSync(join(d, '.vercel', 'output')));

  if (!outputRoot) {
    console.error(
      [
        '',
        'FAIL  Build finished but no .vercel/output was produced.',
        '',
        'This almost always means the deployer is not wired up. Check that',
        'src/mastra/index.ts passes `deployer: new VercelDeployer(...)` to',
        'new Mastra({...}). Without it, mastra build emits a plain Node bundle',
        'and there is nothing for Vercel to run.',
      ].join('\n'),
    );
    process.exitCode = 1;
  } else {
    console.log(`\n> vercel deploy --prebuilt (from ${outputRoot})`);
    const args = ['vercel', 'deploy', '--prebuilt'];
    if (prod) args.push('--prod');

    const code = run('npx', args, outputRoot);
    if (code !== 0) {
      console.error(
        [
          '',
          'FAIL  Deploy failed.',
          '',
          'Common causes:',
          '  - Not logged in            -> run: npx vercel login',
          '  - Missing env vars on Vercel -> set TURSO_DATABASE_URL, TURSO_AUTH_TOKEN',
          '    and your LLM key in the Vercel project settings. Vercel does NOT read .env.',
          '  - maxDuration above your plan limit -> lower it in src/mastra/index.ts',
          '    (60 works on every plan, 300 on Pro, 800 on Enterprise)',
        ].join('\n'),
      );
      process.exitCode = 1;
    }
  }
}
