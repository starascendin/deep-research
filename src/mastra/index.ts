import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { researchWorkflow } from './workflows/researchWorkflow';
import { learningExtractionAgent } from './agents/learningExtractionAgent';
import { evaluationAgent } from './agents/evaluationAgent';
import { reportAgent } from './agents/reportAgent';
import { researchAgent } from './agents/researchAgent';
import { webSummarizationAgent } from './agents/webSummarizationAgent';
import { generateReportWorkflow } from './workflows/generateReportWorkflow';
import { researchWorkflowDirect } from './workflows/researchWorkflowDirect';
import { researchMultiWeb } from './workflows/researchMultiWeb';

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
  workflows: { generateReportWorkflow, researchWorkflow, researchWorkflowDirect, researchMultiWeb },
  observability: {
    default: {
      enabled: true,
    },
  },
  server: {
    // Explicit CORS config to allow dashboard/browser requests with API key header
    cors: {
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'x-mastra-client-type',
        'x-api-key',
      ],
      exposeHeaders: ['Content-Length', 'X-Requested-With'],
      credentials: false,
    },
    // Protect Mastra API routes with a simple API key middleware
    // - Expects `MASTRA_API_KEY` (or `API_KEY`) in environment
    // - Checks `x-api-key` header on `/api/*` routes
    middleware: [
      // CORS/preflight middleware comes first so preflight isn't blocked by auth
      async (c, next) => {
        const origin = c.req.header('Origin') || '*';
        c.header('Vary', 'Origin');
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        c.header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-mastra-client-type, x-api-key'
        );
        c.header('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With');
        c.header('Access-Control-Max-Age', '86400');

        if (c.req.method === 'OPTIONS') {
          return new Response(null, { status: 204 });
        }

        await next();
      },
      {
        path: '/api/*',
        handler: async (c, next) => {
          const configuredKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
          // Enforce only when explicitly enabled
          const enforce = process.env.MASTRA_ENFORCE_API_KEY === 'true';

          // Allow readiness path to bypass auth (prevents 401 on probes)
          const url = new URL(c.req.url);
          const path = (c.req as any).path ?? url.pathname;
          const readinessPath = process.env.READINESS_CHECK_PATH || '/api';
          const readinessVariants = new Set<string>([
            readinessPath,
            readinessPath.endsWith('/') ? readinessPath.slice(0, -1) : `${readinessPath}/`,
            '/api',
            '/api/',
          ]);
          const isReadiness = readinessVariants.has(path);

          // Always let OPTIONS through (handled by CORS middleware above)
          if (c.req.method === 'OPTIONS') {
            return next();
          }

          if (!enforce || isReadiness) {
            // Enforcement disabled or readiness probe: skip
            return next();
          }

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
