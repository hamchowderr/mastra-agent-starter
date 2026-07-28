import { z } from 'zod';

/**
 * Environment validation. Runs before anything else and exits(1) with a readable
 * list of what is wrong.
 *
 * Failure messages here are read by a coding agent, not a person. Every message
 * names the variable AND the next action to take.
 */

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // libSQL / Turso — the single store for memory, threads, messages, traces and
    // semantic-recall vectors.
    //   Local:    leave blank -> file:./mastra.db, zero setup.
    //   Deployed: MUST be a libsql:// Turso URL. Enforced by the guard below.
    TURSO_DATABASE_URL: z.string().default('file:./mastra.db'),
    TURSO_AUTH_TOKEN: z.string().optional(),

    // At least one is required — enforced by the refine below.
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

    // Embedder for semantic recall. Leave empty — src/mastra/lib/embedder.ts
    // picks a model from whichever provider key is present, and disables
    // semantic recall if none can embed. Set this only to force a specific model.
    // Must NOT have a default: a default here would override that resolution.
    EMBEDDING_MODEL: z.string().default(''),

    // Optional JWT gate. When set, all /api/* routes and Studio require a Bearer
    // token signed with this secret. Leave unset for open local dev.
    MASTRA_JWT_SECRET: z
      .string()
      .min(32, 'must be at least 32 chars — generate one with: openssl rand -hex 32')
      .optional(),

    MASTRA_TELEMETRY_DISABLED: z.string().optional(),

    // Set automatically by Vercel. Used to detect a deployed environment.
    VERCEL: z.string().optional(),
  })
  .refine(
    (e) => Boolean(e.ANTHROPIC_API_KEY || e.OPENAI_API_KEY || e.GOOGLE_GENERATIVE_AI_API_KEY),
    {
      message:
        'No LLM provider key found. Set ANTHROPIC_API_KEY (recommended), OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in .env — get an Anthropic key at https://console.anthropic.com/settings/keys',
    },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:\n');
  for (const [key, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${key}: ${(errors as string[]).join(', ')}`);
  }
  for (const err of parsed.error.flatten().formErrors) {
    console.error(`  ${err}`);
  }
  console.error('\nFix: copy .env.example to .env and fill in the values it describes.');
  process.exit(1);
}

const data = parsed.data;

/**
 * A deployed environment plus a file database is data loss, not a warning.
 *
 * Vercel's filesystem is ephemeral and largely read-only. A `file:` libSQL
 * database appears to work, then silently loses every write between invocations.
 * Fail at boot instead of losing user data quietly.
 */
/**
 * Detect "deployed" from Vercel's own signal, NOT from NODE_ENV.
 *
 * `mastra dev` bundles and runs the output with NODE_ENV=production even when
 * running locally, so keying off NODE_ENV blocks local development. Vercel sets
 * VERCEL=1 in every deployed environment (production, preview and development),
 * which is the reliable signal. Deploying to a host other than Vercel needs its
 * own check added here.
 */
const isDeployed = data.VERCEL === '1';

if (isDeployed && data.TURSO_DATABASE_URL.startsWith('file:')) {
  console.error(
    [
      'TURSO_DATABASE_URL is a local file database, but this is a deployed environment.',
      '',
      "Vercel's filesystem is ephemeral. A file: database loses all data between",
      'invocations — memory, threads and messages silently disappear.',
      '',
      'Fix: create a Turso database and set both variables in the Vercel project.',
      '  1. Go to https://turso.tech and create a database',
      '  2. TURSO_DATABASE_URL=libsql://<your-db>.turso.io',
      '  3. TURSO_AUTH_TOKEN=<token from the Turso dashboard>',
      '',
      'Local development does not need this. Leave both unset and it uses file:./mastra.db.',
    ].join('\n'),
  );
  process.exit(1);
}

if (isDeployed && data.TURSO_DATABASE_URL.startsWith('libsql://') && !data.TURSO_AUTH_TOKEN) {
  console.error(
    [
      'TURSO_DATABASE_URL points at Turso Cloud but TURSO_AUTH_TOKEN is not set.',
      'Every database call will fail authentication.',
      '',
      'Fix: copy the token from https://turso.tech and set TURSO_AUTH_TOKEN in the Vercel project.',
    ].join('\n'),
  );
  process.exit(1);
}

export const env = Object.freeze(data);
export type Env = typeof env;
