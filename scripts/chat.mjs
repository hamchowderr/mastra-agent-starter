#!/usr/bin/env node
/**
 * Talk to the agent through the RUNNING dev server so the conversation appears
 * in Mastra Studio.
 *
 *   npm run chat -- "your message"
 *   npm run chat -- "your message" --thread demo-2 --resource alice
 *   npm run chat -- "run the workflow" --workflow leadTriage
 *
 * Why this exists: the user watches Studio. A one-off script that constructs its
 * own Mastra instance runs in a separate process, writes nothing the running
 * server can see, and shows up nowhere in the UI. Worse, libSQL allows only one
 * process to hold the database — a second Mastra process causes lock errors.
 *
 * So: always drive the agent over HTTP against the server that is already
 * running, and always pass memory.thread + memory.resource. Without those, the
 * call is a stateless one-off and no thread appears in Studio.
 */

const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:4111';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const message = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0];
const thread = arg('thread', 'demo-thread');
const resource = arg('resource', 'demo-user');
const agentId = arg('agent', 'leadIntake');
const workflowId = arg('workflow', null);

if (!message) {
  console.error('Usage: npm run chat -- "your message" [--thread ID] [--resource ID] [--agent ID] [--workflow ID]');
  process.exitCode = 1;
}

async function post(path, body, ms = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function serverUp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runWorkflow(id, text) {
  const created = await post(`/api/workflows/${id}/create-run`, {});
  const runId = created.json?.runId;
  if (!runId) {
    console.error(`FAIL  create-run for workflow "${id}" returned no runId`);
    console.error(`      ${created.text.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`run ${runId}`);

  // runId is a QUERY parameter here, not a body field. Putting it in the body
  // is silently ignored, and start-async then executes a different, freshly
  // created run — orphaning the one create-run just made.
  const started = await post(
    `/api/workflows/${id}/start-async?runId=${encodeURIComponent(runId)}`,
    { inputData: { text } },
  );

  const result = started.json;
  if (result?.status === 'failed') {
    const stepErr = Object.values(result.steps ?? {}).find((s) => s?.error)?.error?.message;
    console.error(`FAIL  workflow "${id}" failed: ${stepErr ?? 'unknown error'}`);
    console.error('      Open http://localhost:4111 to see which step failed and why.');
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result?.result ?? result, null, 2));
  console.log(`\nWatch it in Studio: ${BASE}`);
}

async function runAgent(id, text) {
  // memory.thread + memory.resource are what make this show up in Studio.
  const res = await post(`/api/agents/${id}/generate`, {
    messages: [{ role: 'user', content: text }],
    memory: { thread, resource },
  });

  if (!res.ok) {
    const hint = /api[-_ ]?key|unauthor/i.test(res.text)
      ? 'The LLM API key is missing or invalid. Fix it in .env and restart "npm run dev".'
      : res.text.slice(0, 300);
    console.error(`FAIL  agent "${id}" returned HTTP ${res.status}`);
    console.error(`      ${hint}`);
    process.exitCode = 1;
    return;
  }

  console.log(res.json?.text ?? JSON.stringify(res.json?.object ?? res.json, null, 2));
  console.log(`\nthread "${thread}" / resource "${resource}" — watch it in Studio: ${BASE}`);
}

if (message) {
  if (!(await serverUp())) {
    console.error(`FAIL  Cannot reach ${BASE}`);
    console.error('      Start it first: "npm run dev" in another shell, then re-run this.');
    process.exitCode = 1;
  } else if (workflowId) {
    await runWorkflow(workflowId, message);
  } else {
    await runAgent(agentId, message);
  }
}
