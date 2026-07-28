import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadIntakeAgent, LeadSchema } from '../agents/lead-intake';

/**
 * # Lead Triage Workflow (canonical example)
 *
 * What it does:
 *   Raw inbound text -> structured lead (via the leadIntake agent) -> a routing
 *   decision. Shows the two things every workflow needs: calling an agent from a
 *   step, and doing deterministic logic on its output.
 *
 * Who calls it:
 *   POST /api/workflows/leadTriage/start
 *
 * How to test:
 *   npm run verify
 *
 * Copy this file, rename, and adapt for new workflows.
 */

const TriageSchema = z.object({
  lead: LeadSchema,
  queue: z.enum(['sales-urgent', 'sales-standard', 'support', 'nurture']),
  reason: z.string(),
});

/** Step 1 — extract structured data by calling the agent. */
const extractLead = createStep({
  id: 'extract-lead',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: LeadSchema,
  execute: async ({ inputData }) => {
    const result = await leadIntakeAgent.generate(inputData.text, {
      structuredOutput: { schema: LeadSchema },
    });
    return result.object;
  },
});

/** Step 2 — deterministic routing. No model call, so it is cheap and testable. */
const routeLead = createStep({
  id: 'route-lead',
  inputSchema: LeadSchema,
  outputSchema: TriageSchema,
  execute: async ({ inputData }) => {
    const lead = inputData;

    if (lead.intent === 'support') {
      return { lead, queue: 'support' as const, reason: 'Support intent' };
    }
    if (lead.urgency === 'high') {
      return { lead, queue: 'sales-urgent' as const, reason: 'High urgency' };
    }
    if (lead.email === null) {
      return { lead, queue: 'nurture' as const, reason: 'No contact email captured' };
    }
    return { lead, queue: 'sales-standard' as const, reason: 'Standard sales lead' };
  },
});

export const leadTriageWorkflow = createWorkflow({
  id: 'leadTriage',
  description: 'Extracts a structured lead from raw text and routes it to a queue.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: TriageSchema,
})
  .then(extractLead)
  .then(routeLead)
  .commit();
