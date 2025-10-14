import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { researchWorkflow } from './workflows/researchWorkflow';
import { learningExtractionAgent } from './agents/learningExtractionAgent';
import { evaluationAgent } from './agents/evaluationAgent';
import { reportAgent } from './agents/reportAgent';
import { researchAgent } from './agents/researchAgent';
import { webSummarizationAgent } from './agents/webSummarizationAgent';
import { generateReportWorkflow } from './workflows/generateReportWorkflow';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  agents: {
    researchAgent,
    reportAgent,
    evaluationAgent,
    learningExtractionAgent,
    webSummarizationAgent,
  },
  workflows: { generateReportWorkflow, researchWorkflow },
  observability: {
    default: {
      enabled: true,
    },
  },
  server: {
    // Protect Mastra API routes with a simple API key middleware
    // - Expects `MASTRA_API_KEY` (or `API_KEY`) in environment
    // - Checks `x-api-key` header on `/api/*` routes
    middleware: [
      {
        path: '/api/*',
        handler: async (c, next) => {
          const isDev = process.env.NODE_ENV !== 'production' || process.env.MASTRA_DEV === 'true';
          const forceEnforce = process.env.MASTRA_ENFORCE_API_KEY === 'true';
          const enforce = forceEnforce || !isDev;

          if (!enforce) {
            // In local dev, skip API key enforcement for convenience
            return next();
          }

          const configuredKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
          if (!configuredKey) {
            return new Response('Server misconfigured: missing MASTRA_API_KEY', { status: 500 });
          }

          const providedKey = c.req.header('x-api-key');
          if (!providedKey || providedKey !== configuredKey) {
            return new Response('Unauthorized', { status: 401 });
          }

          await next();
        },
      },
    ],
  },
});
