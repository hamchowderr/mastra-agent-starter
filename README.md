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

## What you need

Nothing is needed up front except an LLM key. The rest only matters when you
deploy.

### To build and run locally

| | Why | Cost |
|---|---|---|
| **An LLM API key** | The agent calls a model. [Anthropic](https://console.anthropic.com/settings/keys) is the default; [OpenAI](https://platform.openai.com/api-keys) and [Google](https://aistudio.google.com/apikey) also work. | Pay per use |
| **Node 20.9+** | Runs the server. | Free |

That is it. Storage creates a file on your machine — no database account, no
Docker, nothing to sign up for.

> **Optional:** an OpenAI or Google key also switches on *semantic recall*, where
> the agent remembers relevant things from older conversations. Anthropic does
> not publish an embedding model, so on an Anthropic-only setup recall stays off
> and everything else works normally.

### To deploy

| | Why | Cost |
|---|---|---|
| **A [GitHub](https://github.com) account** | You need one anyway to copy this template. | Free |
| **A [Vercel](https://vercel.com) account** | Where the agent runs. | Free tier is enough to start |
| **A [Turso](https://turso.tech) database** | **Required.** Vercel does not keep files between requests, so the local database cannot be used in production. | Free tier is generous |

Your coding agent will run `vercel login` and walk you through it. You approve in
the browser once.

### Not required

**A [Mastra Cloud](https://mastra.ai) account is optional.** Tracing, the Studio
UI, and evals all run locally without one. Add `MASTRA_PLATFORM_ACCESS_TOKEN` and
`MASTRA_PROJECT_ID` later only if you want traces shipped to a hosted dashboard.

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
npm run chat      Talk to the agent — appears live in Studio
npm run verify    Check the agent actually works
npm run eval      Score the agent against test cases
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
