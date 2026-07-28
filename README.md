# Mastra Agent Starter

Build and deploy an AI agent. Designed to be driven by a coding agent — you
describe what you want, it writes and ships it.

You do not need to use a terminal. Point Claude Cowork (or Claude Code, Cursor,
or any coding agent) at this repository and say what the agent should do.

## Getting started

1. Click **Use this template** at the top of this repo to make your own copy.
2. Open your copy in your coding agent.
3. Say what you want, for example:

   > Build me an agent that reads customer support emails and pulls out the
   > order number, the problem, and how angry the customer is.

The agent handles the rest — installing, running, testing, and deploying.

### What you will need

- An **LLM API key**. [Anthropic](https://console.anthropic.com/settings/keys) is
  the default. Your coding agent will ask for it and put it in the right place.
- A **[Turso](https://turso.tech) database** — but only when you deploy. Running
  locally needs nothing; it creates a database file on your machine.

## What is in here

| | |
|---|---|
| An example agent | Reads messy text, returns clean structured data |
| An example tool | Validates an email address |
| An example workflow | Runs the agent, then routes the result |
| Memory | Remembers across conversations, per user |
| Evals | Scores agent output so changes do not quietly regress |
| A skill | Teaches your coding agent how this project works |

Everything is an example to copy. Rename it, change it, delete what you do not need.

## Commands

Your coding agent runs these. They are listed so you know what it is doing.

```
npm install       Install dependencies
npm run setup     Create .env, check everything is present
npm run dev       Start the server at http://localhost:4111
npm run verify    Check the agent actually works
npm run deploy    Ship it to Vercel
```

`http://localhost:4111` is Mastra Studio — a browser UI where you can talk to
your agent, inspect what it did, and see why it answered the way it did.

## Deploying

Deploys to [Vercel](https://vercel.com). You will need a Turso database first —
a local file database cannot be used in production, because Vercel's servers do
not keep files between requests. The project will tell you this clearly rather
than losing your data quietly.

## Under the hood

[Mastra](https://mastra.ai) on Node 20+, TypeScript, and libSQL/Turso for
storage. Agents are exposed over REST, MCP, and Studio.

Full technical detail is in [AGENTS.md](./AGENTS.md).
