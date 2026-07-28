import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

import { env } from '../../lib/env';

/**
 * Embedder for memory semantic recall — optional by design.
 *
 * This template deploys to Vercel, so a HOSTED embedding model is used rather
 * than the local `fastembed` model other Mastra templates default to. fastembed
 * is a native ONNX binding: it cannot run on serverless or edge runtimes.
 *
 * Anthropic does not publish an embedding model. An Anthropic-only project
 * therefore has no hosted embedder available, so semantic recall is DISABLED
 * rather than crashing at boot. Message history and working memory still work —
 * only "recall a relevant thing from an older conversation" is switched off.
 *
 * Resolution order:
 *   1. EMBEDDING_MODEL, if explicitly set
 *   2. openai/text-embedding-3-small,  if OPENAI_API_KEY is present
 *   3. google/text-embedding-004,      if GOOGLE_GENERATIVE_AI_API_KEY is present
 *   4. null -> semantic recall off
 */
function resolveEmbeddingModel(): string | null {
  if (env.EMBEDDING_MODEL) return env.EMBEDDING_MODEL;
  if (env.OPENAI_API_KEY) return 'openai/text-embedding-3-small';
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) return 'google/text-embedding-004';
  return null;
}

const modelId = resolveEmbeddingModel();

if (!modelId) {
  console.warn(
    [
      'Semantic recall is OFF: no embedding-capable provider key found.',
      'Message history and working memory still work.',
      'To enable it, set OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in .env',
      '(Anthropic does not offer an embedding model).',
    ].join('\n  '),
  );
}

/** null when no embedding provider is available — callers must handle it. */
export const embedder = modelId ? new ModelRouterEmbeddingModel(modelId) : null;
