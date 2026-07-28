#!/usr/bin/env node
/**
 * Proves the agent actually works. Exits non-zero on any failure so a coding
 * agent gets a real signal instead of parsing log text.
 *
 * Requires the dev server to be running: npm run dev
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:4111';

/**
 * fetch with a timeout that is always cleared.
 *
 * Do not use AbortSignal.timeout() here: its timer stays pending, and calling
 * process.exit() while it is open crashes Node on Windows with a libuv
 * assertion (UV_HANDLE_CLOSING) and a 127 exit code instead of a clean 1.
 */
async function fetchWithTimeout(url, options = {}, ms = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

class VerifyError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

function fail(message, hint) {
  throw new VerifyError(message, hint);
}

async function run() {
  // 1. Is the server up?
  try {
    const health = await fetchWithTimeout(`${BASE}/health`, {}, 5_000);
    if (!health.ok) {
      fail(
        `GET /health returned ${health.status}`,
        'The server started but is unhealthy. Check the "npm run dev" output.',
      );
    }
  } catch (err) {
    if (err instanceof VerifyError) throw err;
    fail(
      `Cannot reach ${BASE}`,
      'Start it first: run "npm run dev" in another shell, wait for it to listen, then re-run "npm run verify".',
    );
  }
  console.log('OK    server is up');

  // 2. Does the agent return usable output?
  const prompt =
    'Hi, this is John Carter from Acme Corp (john@acme.io). We need pricing for 50 seats by Friday — this is blocking our rollout.';

  let res;
  try {
    res = await fetchWithTimeout(`${BASE}/api/agents/leadIntake/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // memory.thread + memory.resource make this run persist and appear as a
      // conversation in Mastra Studio, so the user can watch verification happen
      // instead of taking the exit code on faith. Without them it is a stateless
      // one-off and nothing shows in the UI.
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'verify', resource: 'verify-user' },
      }),
    });
  } catch (err) {
    fail(
      `Request to the agent failed: ${err.message}`,
      'Most common cause is a missing or invalid LLM API key. Check .env and the "npm run dev" output.',
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const hint = /api[-_ ]?key|unauthor|401|403/i.test(body)
      ? 'The LLM API key is missing or invalid. Fix it in .env, restart "npm run dev", then re-run.'
      : body.slice(0, 400) || 'No response body. Check the "npm run dev" output for the real error.';
    fail(`Agent returned HTTP ${res.status}`, hint);
  }

  const data = await res.json().catch(() => null);
  if (!data) fail('Agent response was not valid JSON', 'Check the "npm run dev" output.');

  const text = data.text ?? JSON.stringify(data.object ?? data);
  if (!text || text.length < 2) {
    fail(
      'Agent returned an empty response',
      'The model produced nothing. Check the model name in src/mastra/agents/lead-intake.ts.',
    );
  }
  console.log('OK    agent responded');

  // 3. Did it extract the right thing? Catches a wired-up-but-wrong agent.
  const lower = text.toLowerCase();
  const found = ['john', 'acme'].filter((needle) => lower.includes(needle));
  if (found.length < 2) {
    fail(
      'Agent responded but did not extract the expected fields',
      `Expected the name and company in the output. Got: ${text.slice(0, 300)}`,
    );
  }
  console.log('OK    agent extracted the expected fields');

  console.log('\nVerified. The agent is working.');
}

// Set exitCode rather than calling process.exit() so pending handles unwind
// cleanly and the shell sees a real 1.
run().catch((err) => {
  if (err instanceof VerifyError) {
    console.error(`FAIL  ${err.message}`);
    if (err.hint) console.error(`      ${err.hint}`);
  } else {
    console.error(`FAIL  Unexpected error: ${err.message}`);
  }
  process.exitCode = 1;
});
