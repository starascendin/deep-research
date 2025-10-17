import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { researchWorkflow } from './workflows/researchWorkflow';
import { learningExtractionAgent } from './agents/learningExtractionAgent';
import { evaluationAgent } from './agents/evaluationAgent';
import { reportAgent } from './agents/reportAgent';
import { researchAgent } from './agents/researchAgent';
import { xaiSearchAgent } from './agents/xaiSearchAgent';
import { webSummarizationAgent } from './agents/webSummarizationAgent';
import { generateReportWorkflow } from './workflows/generateReportWorkflow';
import { researchWorkflowDirect } from './workflows/researchWorkflowDirect';
import { basicAgent } from './agents/basicAgent';
import { exaMcpWebSearchAgent } from './agents/exaMcpWebSearchAgent';
import { websearchNetworkAgent } from './agents/websearchNetworkAgent';
import { basicAgentWorkflow } from './workflows/basicAgentWorkflow';
import { researchMultiWeb } from './workflows/researchMultiWeb';
import { researchMultiWebXai } from './workflows/researchMultiWebXai';
import { testWorkflow01 } from './workflows/testWorkflow01';
import { weatherTool } from './tools/weatherTool';
import { webSearchTool } from './tools/webSearchTool';
import { evaluateResultTool } from './tools/evaluateResultTool';
import { extractLearningsTool } from './tools/extractLearningsTool';
import { openaiWebSearchTool } from './tools/openaiWebSearchTool';
import { xaiWebSearchTool } from './tools/xaiWebSearchTool';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  agents: {
    basicAgent,
    researchAgent,
    xai_searchagent: xaiSearchAgent,
    reportAgent,
    evaluationAgent,
    learningExtractionAgent,
    webSummarizationAgent,
    exaMcpWebSearchAgent,
    websearchNetworkAgent,
  },
  workflows: {
    generateReportWorkflow,
    researchWorkflow,
    researchWorkflowDirect,
    researchMultiWeb,
    researchMultiWebXai,
    basicAgentWorkflow,
    testWorkflow01,
  },
  // Note: Mastra Config no longer accepts a top-level `tools` registry in this version's types.
  // Tools remain available via direct imports in agents and workflows.
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
        'x-mastra-cloud',
        'x-playground-access',
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
          'Content-Type, Authorization, x-mastra-client-type, x-api-key, x-mastra-cloud, x-playground-access'
        );
        c.header('Access-Control-Expose-Headers', 'Content-Length, X-Requested-With');
        c.header('Access-Control-Max-Age', '86400');

        if (c.req.method === 'OPTIONS') {
          return new Response(null, { status: 204 });
        }

        try {
          const url = new URL(c.req.url);
          const path = (c.req as any).path ?? url.pathname;
          // Gate noisy http logs to production or explicit opt-in
          const logHttp = process.env.MASTRA_LOG_HTTP === 'true' || process.env.NODE_ENV === 'production';
          const isDevRefresh = path === '/__refresh' || path.startsWith('/refresh-events');
          if (logHttp && !isDevRefresh) {
            // Do not log sensitive headers
            const ua = c.req.header('user-agent');
            const clientType = c.req.header('x-mastra-client-type');
            console.info('[http] request', { method: c.req.method, path, clientType, ua });
          }
        } catch {}

        await next();
      },
      {
        path: '/api/*',
        handler: async (c, next) => {
          const configuredKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
          // Enforce only when explicitly enabled
          const enforce = process.env.MASTRA_ENFORCE_API_KEY === 'true';
          const allowCloudJwt = process.env.MASTRA_ALLOW_CLOUD_JWT === 'true';

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

          // Allow Mastra Cloud dashboard access via JWT when enabled
          const isFromMastraCloudHeader = c.req.header('x-mastra-cloud') === 'true';
          const origin = c.req.header('Origin');
          const isFromMastraCloudOrigin = origin === 'https://cloud.mastra.ai';
          const bearerToken = c.req.header('authorization') || c.req.header('x-playground-access');
          const hasBearer = !!bearerToken && bearerToken.startsWith('Bearer ');
          if (allowCloudJwt && (isFromMastraCloudHeader || isFromMastraCloudOrigin) && hasBearer) {
            return next();
          }

          if (!configuredKey) {
            return new Response('Server misconfigured: missing MASTRA_API_KEY', { status: 500 });
          }

          const providedKey = c.req.header('x-api-key');
          if (!providedKey || providedKey !== configuredKey) {
            return new Response('Unauthorized', { status: 401 });
          }

          // Log safe subset of request info for API routes (gated)
          try {
            const logHttp = process.env.MASTRA_LOG_HTTP === 'true' || process.env.NODE_ENV === 'production';
            if (logHttp) {
              const q = url.search || '';
              console.info('[api] authorized request', { method: c.req.method, path: `${path}${q}` });
            }
          } catch {}

          await next();
        },
      },
    ],
  },
});
