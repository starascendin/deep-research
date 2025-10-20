import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../tools/webSearchTool';
import { openaiWebSearchTool } from '../tools/openaiWebSearchTool';
import { xaiWebSearchTool } from '../tools/xaiWebSearchTool';

// New, independent Exa search step (no imports from existing tools)
const exaSearchStep = createStep({
  id: 'exa-web-search-new',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    query: z.string(),
    exaResults: z.array(
      z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
    ).default([]),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const logger = mastra.getLogger();
    logger.info('[workflow:parallel-web-summarizer][step:exa-web-search-new] start', { query });

    try {
      const exa = await (webSearchTool as any).execute({ context: { query, skipSummarization: true, numResults: 3 }, mastra });
      const exaResults = ((exa?.results ?? []) as Array<any>).map(r => ({
        title: r?.title || undefined,
        url: r?.url || undefined,
        content: r?.content || '',
      }));
      return { query, exaResults };
    } catch (error: any) {
      logger.error('[exa-web-search-new] error', { message: error?.message });
      return { query, exaResults: [] };
    }
  },
});

// New, independent OpenAI web search step (no imports from existing tools)
const openaiSearchStep = createStep({
  id: 'openai-web-search-new',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
    oaiResults: z.array(
      z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
    ).default([]),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const logger = mastra.getLogger();
    logger.info('[workflow:parallel-web-summarizer][step:openai-web-search-new] start', { query });

    try {
      const oai = await (openaiWebSearchTool as any).execute({ context: { query }, mastra });
      const text = (oai as any)?.text || '';
      const oaiSources = Array.isArray((oai as any)?.sources) ? (oai as any).sources : [];
      const fromSources = (oaiSources as any[])
        .map((s: any) => ({
          title: s?.title || s?.name || s?.pageTitle || s?.publisher || undefined,
          url: s?.url || s?.link || s?.href || (s?.metadata && s?.metadata.url) || undefined,
          content: s?.snippet || s?.description || s?.summary || '',
        }))
        .filter((r: any) => !!r.url);
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const fallbackUrls: string[] = Array.from(new Set((text.match(urlRegex) || []).slice(0, 5)));
      const fromText = fallbackUrls.map((u) => ({ title: undefined, url: u, content: '' }));
      const oaiResults = (fromSources.length > 0 ? fromSources : fromText) as Array<{ title?: string; url?: string; content?: string }>;
      return { query, oaiResults };
    } catch (error: any) {
      logger.error('[openai-web-search-new] error', { message: error?.message });
      return { query, oaiResults: [] };
    }
  },
});

// New, independent xAI live search step (no imports from existing tools)
const xaiAgentSearchStep = createStep({
  id: 'xai-web-search-new',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
    xaiResults: z.array(
      z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
    ).default([]),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const logger = mastra.getLogger();
    logger.info('[workflow:parallel-web-summarizer][step:xai-web-search-new] start', { query });

    try {
      const xai = await (xaiWebSearchTool as any).execute({ context: { query }, mastra });
      const text = (xai as any)?.text || '';
      const xaiSources = Array.isArray((xai as any)?.sources) ? (xai as any).sources : [];
      const fromSources = (xaiSources as any[])
        .map((s: any) => ({
          title: s?.title || s?.name || s?.pageTitle || s?.publisher || undefined,
          url: s?.url || s?.link || s?.href || (s?.metadata && s?.metadata.url) || undefined,
          content: s?.snippet || s?.description || s?.summary || '',
        }))
        .filter((r: any) => !!r.url);
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const fallbackUrls: string[] = Array.from(new Set((text.match(urlRegex) || []).slice(0, 5)));
      const fromText = fallbackUrls.map((u) => ({ title: undefined, url: u, content: '' }));
      const xaiResults = (fromSources.length > 0 ? fromSources : fromText) as Array<{ title?: string; url?: string; content?: string }>;
      return { query, xaiResults };
    } catch (error: any) {
      logger.error('[xai-web-search-new] error', { message: error?.message });
      return { query, xaiResults: [] };
    }
  },
});

// Summarizer step: merges results and calls the new WebSearchSummarizerAgent to produce final report
const summarizeReportStep = createStep({
  id: 'summarize-into-report-new',
  inputSchema: z.object({
    'exa-web-search-new': z.object({
      query: z.string(),
      exaResults: z.array(
        z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
      ).default([]),
    }),
    'openai-web-search-new': z.object({
      query: z.string(),
      oaiResults: z.array(
        z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
      ).default([]),
    }),
    'xai-web-search-new': z.object({
      query: z.string(),
      xaiResults: z.array(
        z.object({ title: z.string().optional(), url: z.string().optional(), content: z.string().optional() })
      ).default([]),
    }),
  }),
  outputSchema: z.object({
    content: z.string(),
    citations: z.array(z.number()).default([]),
    sources: z.array(
      z.object({ index: z.number(), title: z.string().optional(), url: z.string() })
    ).default([]),
  }),
  execute: async ({ inputData, mastra }) => {
    const exaPart = inputData['exa-web-search-new'];
    const oaiPart = inputData['openai-web-search-new'];
    const xaiPart = inputData['xai-web-search-new'];
    const query = exaPart?.query || oaiPart?.query || xaiPart?.query || '';
    const logger = mastra.getLogger();
    logger.info('[workflow:parallel-web-summarizer][step:summarize-into-report-new] start', { query });

    // Merge + deduplicate by URL; prefer entries with content
    const map = new Map<string, { title?: string; url?: string; content?: string }>();
    const take = (r?: { title?: string; url?: string; content?: string }) => {
      if (!r?.url) return;
      const existing = map.get(r.url);
      if (!existing) {
        map.set(r.url, r);
      } else {
        const has = (existing.content || '').trim().length;
        const newLen = (r.content || '').trim().length;
        if (has === 0 && newLen > 0) map.set(r.url, r);
      }
    };
    for (const r of (exaPart?.exaResults ?? [])) take(r);
    for (const r of (oaiPart?.oaiResults ?? [])) take(r);
    for (const r of (xaiPart?.xaiResults ?? [])) take(r);
    const merged = Array.from(map.values()).slice(0, 20); // keep top 20 to limit tokens

    try {
      const numberedSources = merged
        .map((r, i) => ({ index: i + 1, title: r.title, url: r.url || '', content: r.content || '' }))
        .filter(s => !!s.url);

      const agent = mastra.getAgent('WebSearchSummarizerAgent');
      if (!agent || typeof (agent as any).generate !== 'function') {
        throw new Error('WebSearchSummarizerAgent not registered');
      }
      const response = await (agent as any).generate([
        {
          role: 'user',
          content: `User query: ${query}\n\nYou are given normalized, NUMBERED sources (JSON). Produce the Executive Summary report per your instructions.\n\nSTRICT CITATION RULES:\n- Use inline numeric citations [n] where n corresponds EXACTLY to the provided source index.\n- Only cite indices from the list below.\n- Include a final Sources section listing [n] Title — URL for the sources you used.\n\nNumbered Sources (JSON):\n${JSON.stringify(numberedSources)}`,
        },
      ]);

      // Extract citations like [1], [2] ... and map to used sources
      const reportText = typeof response?.text === 'string' ? response.text : String(response ?? '');
      const citationMatches = Array.from(reportText.matchAll(/\[(\d+)\]/g)) as RegExpMatchArray[];
      const citationSet = new Set<number>();
      for (const m of citationMatches) {
        const n = parseInt(m[1] as string, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= numberedSources.length) citationSet.add(n);
      }
      const citations = Array.from(citationSet).sort((a, b) => a - b);
      const used = numberedSources
        .filter(s => citationSet.has(s.index))
        .map(s => ({ index: s.index, title: s.title, url: s.url }));

      return { content: reportText, citations, sources: used };
    } catch (error: any) {
      const msg = `Failed to generate summary report: ${error?.message || 'unknown error'}`;
      return { content: msg, citations: [], sources: [] };
    }
  },
});

export const parallelWebSummarizer = createWorkflow({
  id: 'parallel-web-summarizer',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    content: z.string(),
    citations: z.array(z.number()).default([]),
    sources: z.array(
      z.object({ index: z.number(), title: z.string().optional(), url: z.string() })
    ).default([]),
  }),
  steps: [exaSearchStep, openaiSearchStep, xaiAgentSearchStep, summarizeReportStep],
});

parallelWebSummarizer
  .parallel([exaSearchStep, openaiSearchStep, xaiAgentSearchStep])
  .then(summarizeReportStep)
  .commit();
