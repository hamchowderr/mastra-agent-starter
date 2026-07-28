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

Requires a Turso database. This is not optional and the app enforces it.

1. Create a database at https://turso.tech
2. Set `TURSO_DATABASE_URL` (a `libsql://` URL) and `TURSO_AUTH_TOKEN` in the
   Vercel project's environment variables, plus the LLM key.
3. `npm run deploy`

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
