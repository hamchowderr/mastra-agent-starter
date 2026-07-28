# CLAUDE.md

Read [AGENTS.md](./AGENTS.md). It is the single source of truth for this project:
commands, layout, how to add an agent or tool, how to deploy, and the invariants.

Quick version:

```
npm install
npm run setup     # creates .env, reports what is missing
npm run dev       # server on :4111, does not exit — run it in the background
npm run verify    # proves the agent works, exits non-zero on failure
```

Three things that cause most mistakes:

1. `npm run dev` is a long-running server. Do not wait for it to finish.
2. A new agent must be registered in **two** places in `src/mastra/index.ts` —
   the `Mastra` instance and the `MCPServer`.
3. Deploying needs Turso. A local `file:` database is refused in production on
   purpose, because Vercel's filesystem is ephemeral.
