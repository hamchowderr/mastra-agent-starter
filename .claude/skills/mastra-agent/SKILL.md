---
name: mastra-agent
description: >
  Build, run, test and deploy a Mastra AI agent in this project. Use when the user
  says "build me an agent", "add an agent that…", "make an agent to…", "run the
  agent", "test the agent", "deploy this", "ship it", "put it live", or asks to
  change what an existing agent does. Covers agent creation, inline tools,
  workflows, local run, verification, and Vercel deployment.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

# Build a Mastra agent

Follow `AGENTS.md` in the repo root for layout and invariants. This skill is the
procedure.

## Before writing code

Ask the user only what you cannot infer:

- **What goes in** — email body, form submission, transcript, webhook payload?
- **What comes out** — the fields they need, and what each means.
- **What it is called by** — a website, an automation, a person in Studio?

Do not ask about models, storage, or memory. Defaults are correct.

## Create the agent

1. Copy `src/mastra/agents/lead-intake.ts` to `src/mastra/agents/<kebab-name>.ts`.
2. Set `id` (camelCase — it becomes the URL: `/api/agents/<id>/generate`), `name`,
   and `description`.
3. Replace the zod output schema with the user's fields. Every field gets
   `.describe()`. Anything that may be absent is `.nullable()`.
4. Rewrite `instructions`. Include these rules verbatim or the model adds chatter:
   - Return null for missing fields. Never guess or fabricate.
   - Respond with ONLY the JSON object. No preamble, no commentary.
   - Never narrate tool calls.
5. Keep `memory: createDefaultMemory()`.
6. Register in `src/mastra/index.ts` in **BOTH** places:
   - `agents: { ... }` on `new Mastra({...})`
   - `agents: { ... }` on `new MCPServer({...})`
   Missing the second is the most common failure. The agent works over REST but is
   invisible to MCP.

## Add a tool

Inline in the agent file, like `validateEmail` in `lead-intake.ts`. Use
`createTool` with `inputSchema` and `outputSchema`. Return a structured result on
failure rather than throwing — the model reads the result and recovers.

## Run and verify

```
npm run typecheck
npm run dev        # long-running server on :4111 — background it, do not wait
npm run verify     # exits non-zero on failure
```

`npm run verify` tests the example agent. After adding your own, extend
`scripts/verify.mjs` with a case for it so future changes stay checked.

## Show the user, do not just report

The user watches **Mastra Studio at http://localhost:4111**. They do not type into
it — you drive, they observe. After any change, run something through the agent so
they see it happen.

```
npm run chat -- "Some realistic input"
npm run chat -- "Some raw lead text" --workflow leadTriage
```

Two rules, both non-negotiable:

- **Drive through the running server over HTTP.** Never write a standalone script
  that builds its own `Mastra` instance. It appears nowhere in Studio, and libSQL
  permits only one process on the database — a second Mastra process throws lock
  errors.
- **Always pass `memory.thread` and `memory.resource`.** Without them the call is
  a stateless one-off, and no conversation appears in the UI. `npm run chat` does
  this for you.

Raw shapes if needed:

```
POST /api/agents/<id>/generate
  { "messages":[{"role":"user","content":"..."}],
    "memory":{"thread":"demo-thread","resource":"demo-user"} }

# runId is a QUERY PARAM on start-async, not a body field. In the body it is
# silently ignored and a different run executes, orphaning the created one.
POST /api/workflows/<id>/create-run                 -> { "runId": "..." }
POST /api/workflows/<id>/start-async?runId=<runId>
  { "inputData":{ "text":"..." } }
```

The full route set and every request schema is at `/api/openapi.json` on the
running server (331 routes). Check there before guessing a shape.

## Deploy

Ask the user for these before starting. Do not begin without them.

- **Vercel account**, and `npx vercel login` completed (browser approval, once)
- **Turso database** from https://turso.tech — required, not optional
- The LLM key already in `.env`

A Mastra Cloud account is **not** required. Say so if asked — traces, Studio and
evals all run locally.

Steps:

1. `npx vercel login` if not authenticated.
2. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and the LLM key **in the Vercel
   project's environment variables**. Vercel does not read `.env` — setting them
   only locally means the deploy boots and exits.
3. `npm run deploy`

The app refuses to boot in production on a `file:` database because Vercel's
filesystem is ephemeral and would silently discard all data.

If runs time out, raise `maxDuration` on the `VercelDeployer` in
`src/mastra/index.ts` (60 default, 300 on Pro, 800 on Enterprise). A value above
the user's plan limit makes the deploy itself fail.

## Failure handling

| Symptom | Cause | Fix |
|---|---|---|
| `npm run verify` cannot reach the server | `dev` not running | Start `npm run dev`, wait for it to listen, retry |
| Boot exits complaining about a variable | Env validation | Read the message — it names the variable and where to get the value |
| Agent returns text wrapped around JSON | Instructions too soft | Add the explicit no-preamble rules above |
| Agent missing from MCP but works over REST | Registered once | Add it to `MCPServer` in `index.ts` |
| Bundler error: symbol `server` already declared | Renamed `serverConfig` | Rename it back to `serverConfig` |
| Nothing appears in Studio | Called without `memory` | Pass `memory.thread` + `memory.resource`, or use `npm run chat` |
| libSQL "database is locked" | A second Mastra process | Kill it. Drive the already-running server over HTTP instead |
| Deploy boots then loses data | `file:` database in production | Set the Turso variables in Vercel |

When `verify` fails, read the `npm run dev` output before editing code. The real
error is there.

## Rules

- Never construct `new Memory()`. Use `createDefaultMemory()`.
- Never import a provider SDK. Models are router ids: `anthropic/claude-sonnet-4-6`.
- Never commit `.env` or a real key.
- Never reorder the `env` import in `src/mastra/index.ts`. It must run first.
