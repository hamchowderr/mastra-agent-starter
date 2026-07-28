# Prompt: add an agent to this project

Paste this to your coding agent when it did not pick up the `mastra-agent` skill
automatically. It is the same procedure the skill contains.

---

You are adding an agent to a Mastra project. Read `AGENTS.md` first and follow
its invariants exactly.

**Ask me only what you cannot infer:** what goes in (email body, form, transcript,
webhook payload), what comes out (the fields, and what each means), and what calls
it. Do not ask about models, storage, or memory — the defaults are correct.

**Then:**

1. Copy `src/mastra/agents/lead-intake.ts` to `src/mastra/agents/<kebab-name>.ts`.
2. Set `id` (camelCase — it becomes the URL `/api/agents/<id>/generate`), `name`,
   and `description`.
3. Replace the zod output schema with my fields. Every field gets `.describe()`.
   Anything that may be absent is `.nullable()`.
4. Rewrite `instructions`. Include these rules verbatim, or the model wraps its
   JSON in commentary:
   - Return null for missing fields. Never guess or fabricate.
   - Respond with ONLY the JSON object. No preamble, no commentary.
   - Never narrate tool calls.
5. Keep `memory: createDefaultMemory()`.
6. Register the agent in `src/mastra/index.ts` in **BOTH** places — the `agents`
   object on `new Mastra({...})` **and** the `agents` object on `new MCPServer({...})`.
   Missing the second one is the most common mistake: the agent works over REST
   but is invisible to MCP.
7. Run `npm run typecheck`, then `npm run dev` in the background, then
   `npm run verify`.
8. Add a case to `scripts/verify.mjs` covering the new agent so future changes
   stay checked.

**Rules:** never construct `new Memory()` — use `createDefaultMemory()`. Never
import a provider SDK — models are router ids like `anthropic/claude-sonnet-4-6`.
Never commit `.env`. Never reorder the `env` import in `src/mastra/index.ts`.

**If something fails,** read the `npm run dev` output before editing code. The
real error is there. `AGENTS.md` has a failure table.
