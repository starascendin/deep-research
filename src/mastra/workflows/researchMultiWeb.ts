import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../tools/webSearchTool';
import { openaiWebSearchTool } from '../tools/openaiWebSearchTool';
import { evaluateResultTool } from '../tools/evaluateResultTool';

// Step 1: Exa search
const exaSearchStep = createStep({
  id: 'exa-web-search',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    query: z.string(),
    exaResults: z
      .array(
        z.object({
          title: z.string().optional(),
          url: z.string().optional(),
          content: z.string().optional(),
        }),
      )
      .default([]),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    console.info('[workflow:research-multi-web][step:exa-web-search] start', { query });
    const exa = await (webSearchTool as any).execute({ context: { query }, mastra });
    const exaResults = (exa?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;
    return { query, exaResults };
  },
});

// Step 2: OpenAI web search preview (parallel-compatible, no dependency on Exa)
const openaiSearchStep = createStep({
  id: 'openai-web-search',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
    oaiResults: z
      .array(
        z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() }),
      )
      .default([]),
  }),
  execute: async ({ inputData }) => {
    const { query } = inputData;
    console.info('[workflow:research-multi-web][step:openai-web-search] start', { query });
    const oai = await (openaiWebSearchTool as any).execute({ context: { query } });
    const oaiResults = (oai?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;
    return { query, oaiResults };
  },
});

// Step 3: Merge, hydrate missing content, then evaluate (expects parallel namespaced outputs)
const mergeEvaluateStep = createStep({
  id: 'merge-evaluate',
  inputSchema: z.object({
    'exa-web-search': z.object({
      query: z.string(),
      exaResults: z
        .array(
          z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() }),
        )
        .default([]),
    }),
    'openai-web-search': z.object({
      query: z.string(),
      oaiResults: z
        .array(
          z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() }),
        )
        .default([]),
    }),
  }),
  outputSchema: z.object({
    query: z.string(),
    researchData: z.any(),
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const exaPart = inputData['exa-web-search'];
    const oaiPart = inputData['openai-web-search'];
    console.info('[workflow:research-multi-web][step:merge-evaluate] start', {
      exaCount: Array.isArray(exaPart?.exaResults) ? exaPart.exaResults.length : 0,
      oaiCount: Array.isArray(oaiPart?.oaiResults) ? oaiPart.oaiResults.length : 0,
    });
    const query = exaPart?.query || oaiPart?.query || '';
    const exaResults = (exaPart?.exaResults ?? []) as Array<{ title?: string; url?: string; content?: string }>;
    const oaiResults = (oaiPart?.oaiResults ?? []) as Array<{ title?: string; url?: string; content?: string }>;

    // Prefer richer content when de-duplicating: keep entry with non-empty content
    const map = new Map<string, { title?: string; url?: string; content?: string }>();
    const consider = (r?: { title?: string; url?: string; content?: string }) => {
      if (!r?.url) return;
      const existing = map.get(r.url);
      if (!existing) {
        map.set(r.url, r);
      } else {
        const existingContent = (existing.content || '').trim();
        const newContent = (r.content || '').trim();
        if (existingContent.length === 0 && newContent.length > 0) {
          map.set(r.url, { ...existing, content: r.content, title: r.title || existing.title });
        }
      }
    };
    // First add Exa (usually has content), then OpenAI (may have empty content)
    for (const r of exaResults) consider(r);
    for (const r of oaiResults) consider(r);
    let merged = Array.from(map.values());

    // Hydrate missing content for up to N URLs by querying Exa with the URL
    const toHydrate = merged.filter(r => !r.content || r.content.trim().length < 20).slice(0, 8);
    for (const r of toHydrate) {
      try {
        const fetched = await (webSearchTool as any).execute({ context: { query: r.url }, mastra });
        const fres = (fetched?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;
        // Find best match by exact URL, else same hostname
        const exact = fres.find(fr => fr.url === r.url);
        const byHost = !exact
          ? (() => {
              try {
                const host = new URL(r.url).host;
                return fres.find(fr => {
                  try { return new URL(fr.url || '').host === host; } catch { return false; }
                });
              } catch {
                return undefined;
              }
            })()
          : undefined;
        const pick = exact || byHost;
        if (pick && pick.content && pick.content.trim().length > 0) {
          r.content = pick.content;
        }
      } catch {
        // ignore hydration failures
      }
    }
    // Refresh merged array in case references changed
    merged = Array.from(map.values());

    const enriched: Array<{ title?: string; url?: string; content?: string; isRelevant?: boolean; reason?: string }> = [];
    for (const r of merged) {
      try {
        const evalRes = await (evaluateResultTool as any).execute({ context: { query, result: r }, mastra });
        enriched.push({ ...r, isRelevant: !!evalRes?.isRelevant, reason: evalRes?.reason });
      } catch {
        enriched.push({ ...r });
      }
    }

    const researchData = {
      queries: [query],
      searchResults: enriched,
      learnings: [],
      completedQueries: [query],
      phase: 'initial',
    };

    const summary = `Multi-source research completed on \"${query}\"\n\n${JSON.stringify(researchData, null, 2)}\n`;
    return { query, researchData, summary };
  },
});

// Step 2: Generate a report from merged results
const multiWebReportStep = createStep({
  id: 'multi-web-report',
  inputSchema: z.object({
    query: z.string(),
    researchData: z.any(),
  }),
  outputSchema: z.object({
    report: z.string(),
    summary: z.string(),
    researchData: z.any(),
    approved: z.boolean().default(true),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query, researchData } = inputData;
    console.info('[workflow:research-multi-web][step:multi-web-report] start', { query });
    try {
      const agent = mastra.getAgent('reportAgent');
      console.info('[agent:reportAgent] generate start');
      const response = await agent.generate([
        {
          role: 'user',
          content: `Original user query: ${query}\n\nYou are given merged research results (JSON) collected from Exa and OpenAI web search. Write a comprehensive, focused report that directly answers the user's query. Follow these rules:\n- Prioritize items in researchData.searchResults where isRelevant is true; ignore others.\n- Synthesize findings into a clear, structured narrative.\n- Include a concise Sources section citing titles and URLs used.\n- Keep the report tightly aligned to the query; avoid drift.\n\nMerged research data (JSON):\n${JSON.stringify(researchData)}`,
        },
      ]);
      return { report: response.text, summary: response.text, researchData, approved: true };
    } catch (error: any) {
      const msg = `Failed to generate report: ${error?.message || 'unknown error'}`;
      return { report: msg, summary: msg, researchData, approved: true };
    }
  },
});

export const researchMultiWeb = createWorkflow({
  id: 'research-multi-web',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    researchData: z.any(),
    approved: z.boolean().default(true),
    report: z.string().optional(),
    summary: z.string().optional(),
  }),
  steps: [exaSearchStep, openaiSearchStep, mergeEvaluateStep, multiWebReportStep],
});

researchMultiWeb
  .parallel([exaSearchStep, openaiSearchStep])
  .then(mergeEvaluateStep)
  .then(multiWebReportStep)
  .commit();
