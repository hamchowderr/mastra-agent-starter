# AGENTS.md

Instructions for the coding agent working in this repository. Read this before
changing anything.

## What this project is

A Mastra AI agent service. It runs a Hono server exposing agents over REST, MCP,
and a browser UI (Mastra Studio). It deploys to Vercel.

The user talks to you. You run the commands. They will not open a terminal.

## Commands

Every action is an npm script. Do not invent commands.

| Command | Does | When |
|---|---|---|
| `npm install` | Install dependencies | First, always |
| `npm run setup` | Create `.env`, check Node + keys | After install |
| `npm run dev` | Start the server on `:4111` (Studio included) | To run it |
| `npm run verify` | Prove the agent works. Exits non-zero on failure | After any change |
| `npm run chat -- "msg"` | Talk to the agent through the running server, visible in Studio | To show the user it works |
| `npm run eval` | Score agent output against the dataset. Costs tokens | Before shipping a prompt change |
| `npm run typecheck` | TypeScript check, no emit | After editing `.ts` |
| `npm run build` | Production build | Before deploy |
| `npm run deploy` | Build + `vercel deploy --prod` | To ship |

`npm run dev` does not exit — it is a server. Run it in the background, or in a
separate shell, then use `npm run verify` to check it. Never wait for `dev` to
finish.

## First run

```
npm install
npm run setup
```

`setup` tells you exactly what is missing. The one thing it cannot do for you is
supply an API key — ask the user for one and write it into `.env`.

Storage needs nothing locally. It uses `file:./mastra.db`, created on first run.

## Driving the agent so the user can watch

The user watches **Mastra Studio at http://localhost:4111**. They do not type into
it. You drive the agent; they observe.

Two rules make that work:

**1. Always drive through the running server over HTTP.** Never write a standalone
script that constructs its own `Mastra` instance. A second process shows up
nowhere in Studio, and libSQL allows only one process to hold the database — a
second Mastra process causes lock errors.

**2. Always pass `memory.thread` and `memory.resource`.** Without them the call is
a stateless one-off: it returns a result but creates no conversation, so the user
sees nothing in the UI.

```bash
npm run chat -- "Message here"
npm run chat -- "Message here" --thread demo-2 --resource alice
npm run chat -- "Some raw lead text" --workflow leadTriage
```

`npm run chat` handles both rules for you. Prefer it over raw curl.

The raw shapes, if you need them:

```
POST /api/agents/<agentId>/generate
  { "messages": [{"role":"user","content":"..."}],
    "memory": { "thread": "demo-thread", "resource": "demo-user" } }

# Workflows are TWO calls, not one.
# runId is a QUERY PARAMETER on start-async, never a body field.
POST /api/workflows/<workflowId>/create-run           -> { "runId": "..." }
POST /api/workflows/<workflowId>/start-async?runId=<runId>
  { "inputData": { "text": "..." } }
```

Putting `runId` in the start-async body is silently ignored: the call creates and
runs a *different* run, leaving the one from `create-run` orphaned. Verified
against `/api/openapi.json` — `runId` is declared as a query param.

After any change, run something through it so the user sees the result in Studio
rather than taking your word for it.

## Layout

```
src/
  lib/env.ts                     Env validation. Fails fast with actionable messages.
  mastra/
    index.ts                     Wiring: agents, workflows, storage, MCP, auth.
    agents/lead-intake.ts        The example agent + its inline tool.
    workflows/lead-triage.ts     The example workflow.
    scorers/                     Eval scorers for the example agent.
    lib/memory.ts                Shared memory policy. Use createDefaultMemory().
    lib/embedder.ts              Embedding model for semantic recall.
    lib/processors.ts            Shared input/output processors.
scripts/
  setup.mjs                      Preflight.
  verify.mjs                     Runtime proof.
```

## Adding an agent

1. Copy `src/mastra/agents/lead-intake.ts` to `src/mastra/agents/<name>.ts`.
2. Change `id`, `name`, `description`, `instructions`, and the output schema.
3. Register it in `src/mastra/index.ts` in **both** places: the `agents` object on
   `new Mastra({...})` and the `agents` object on `new MCPServer({...})`. Missing
   the second one is the most common mistake — the agent works over REST but is
   invisible to MCP.
4. `npm run typecheck`, then `npm run verify`.

Rules for agents:

- Use `createDefaultMemory()` from `../lib/memory`. Never construct `new Memory()`.
- Give every agent a `description`. It is what routing and MCP clients read.
- Structured output belongs in a zod schema, not in prose instructions.
- Instructions must forbid preamble explicitly, or the model will wrap JSON in chatter.
- The model string is a router id like `anthropic/claude-sonnet-4-6`. Do not import a provider SDK directly.

## Adding a tool

Inline tools live in the agent file (see `validateEmail` in `lead-intake.ts`).
Use `createTool` with `inputSchema` and `outputSchema`. Tools shared by more than
one agent go in `src/mastra/tools/`.

## Deploying

### What the user must have first

Ask for these before starting. Do not attempt the deploy without them.

| Needs | Why | Get it |
|---|---|---|
| Vercel account | Where it runs | https://vercel.com |
| Vercel CLI login | `vercel deploy` needs auth | run `npx vercel login` — browser approval, once |
| Turso database | **Required.** Vercel's filesystem is ephemeral, so a `file:` DB loses all data | https://turso.tech |
| LLM API key | Same one used locally | already in `.env` |

A Mastra Cloud account is **not** required. Tracing and Studio work locally
without one. `MASTRA_PLATFORM_ACCESS_TOKEN` + `MASTRA_PROJECT_ID` are optional
and only add hosted trace shipping.

### Steps

1. `npx vercel login` if not already authenticated.
2. Create a Turso database, get the `libsql://` URL and token.
3. Set in the **Vercel project's** environment variables (not just local `.env`):
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and the LLM key.
4. `npm run deploy`

Env vars in `.env` are local only. Vercel does not read that file — variables
must be set on the Vercel project or the deploy boots and immediately exits.

### Function timeout

`src/mastra/index.ts` sets `maxDuration: 60` on the deployer. That is the safe
value for every Vercel plan including Hobby. Agents making several tool calls can
exceed it. Raise to 300 (Pro) or 800 (Enterprise) if runs time out — but a value
above the plan limit makes the **deploy** fail, not just the request.

If you deploy with a `file:` database the process exits at boot with an
explanation. That is deliberate — Vercel's filesystem is ephemeral and a file
database loses every write between invocations.

## Invariants — do not break these

- **`src/lib/env.ts` is imported first in `src/mastra/index.ts`.** It validates
  the environment before anything constructs a client. Do not reorder it.
- **The variable in `index.ts` is named `serverConfig`, not `server`.** `mastra dev`
  generates its own top-level `server` binding and the bundler fails on the collision.
- **Storage is one `LibSQLStore` shared by every domain.** Do not add a second store.
- **Never commit `.env`** or any real key. `.env.example` is the only file that
  describes variables.

## When something fails

Read the error. This project is written so failures state the next action —
`env.ts`, `setup.mjs`, and `verify.mjs` all print what to fix and where to get it.

If `npm run verify` fails, the server output from `npm run dev` has the real
error. Check there before changing code.
