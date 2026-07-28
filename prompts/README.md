# prompts/

Fallback layer.

The knowledge in this project ships three ways so it works regardless of which
coding agent opens it:

1. **`AGENTS.md`** in the repo root — read by essentially every coding agent.
   This is the floor. If nothing else loads, this still works.
2. **`.claude/skills/mastra-agent/SKILL.md`** — surfaces automatically in
   environments that support skills.
3. **This folder** — paste a file in manually when neither of the above loaded.

If your agent already knows what to do, you do not need anything in here.

| File | Use when |
|---|---|
| `build-agent.md` | Your agent did not pick up the skill and you want to add an agent |
