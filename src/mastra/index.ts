// Env validation FIRST — exits the process with an actionable message if wrong.
import { env } from '../lib/env';

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';
import { MCPServer } from '@mastra/mcp';
import { MastraJwtAuth } from '@mastra/auth';

import { leadIntakeAgent } from './agents/lead-intake';
import { leadTriageWorkflow } from './workflows/lead-triage';
import {
  hallucinationScorer,
  promptAlignmentScorer,
  urgencyScorer,
} from './scorers/lead-intake.scorers';

/**
 * One libSQL store for everything — memory, threads, messages, traces, scores.
 *
 * Local:    file:./mastra.db (created on first run, no setup)
 * Deployed: Turso Cloud over libsql:// — enforced in src/lib/env.ts
 */
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const mcpServer = new MCPServer({
  id: 'agent-starter-mcp',
  name: 'mastra-agent-starter',
  version: '1.0.0',
  description: 'MCP server exposing this project\'s agents',
  // Standalone tools shared over MCP. Agent-inline tools (like validateEmail)
  // do not go here — they travel with their agent.
  tools: {},
  agents: { leadIntake: leadIntakeAgent },
});

/**
 * Optional JWT gate. Set MASTRA_JWT_SECRET to require a Bearer token on every
 * /api/* route and on Studio. `/health` stays public so deploy healthchecks work.
 *
 * Must be named `serverConfig`, not `server` — `mastra dev` generates its own
 * top-level `server` binding and the bundler errors on the collision.
 */
const serverConfig = env.MASTRA_JWT_SECRET
  ? { auth: new MastraJwtAuth({ secret: env.MASTRA_JWT_SECRET }) }
  : undefined;

export const mastra = new Mastra({
  ...(serverConfig ? { server: serverConfig } : {}),
  agents: { leadIntake: leadIntakeAgent },
  workflows: { leadTriage: leadTriageWorkflow },
  scorers: { hallucinationScorer, promptAlignmentScorer, urgencyScorer },
  mcpServers: { starterMcp: mcpServer },
  storage,
  logger: new PinoLogger({ name: 'Mastra', level: env.LOG_LEVEL }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra-agent-starter',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
