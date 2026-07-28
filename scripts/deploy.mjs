#!/usr/bin/env node
/**
 * Build, then deploy the prebuilt output to Vercel.
 *
 * Where the artifact actually lands:
 *
 * The deployer builds into `.mastra/.vercel/output` and then MOVES that tree to
 * `<repo root>/.vercel/output` — the standard Build Output API v3 location — as
 * the last step of its bundle phase. So the repo root is correct and
 * `.mastra/.vercel/` is left behind as an empty husk.
 *
 * Do NOT probe `.mastra` for the output. A build killed before the move leaves a
 * stale `.mastra/.vercel/output` that would win the search, deploying a
 * half-built bundle. Worse, `vercel deploy --prebuilt` run from `.mastra` treats
 * `.mastra` as the project root and links a SEPARATE Vercel project.
 *
 * Note the CLI's closing line points at `.mastra/output`. That path is hardcoded
 * regardless of deployer and is not created by the Vercel deployer. Ignore it.
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
  // 2. The artifact lands at the repo root. Verify by the file that proves the
  //    deployer actually ran, not just that a directory exists.
  const outputRoot = root;
  const vcConfig = join(outputRoot, '.vercel', 'output', 'functions', 'index.func', '.vc-config.json');

  if (!existsSync(vcConfig)) {
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
