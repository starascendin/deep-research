import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../tools/webSearchTool';
import { evaluateResultTool } from '../tools/evaluateResultTool';
// import { extractLearningsTool } from '../tools/extractLearningsTool';
import { openaiWebSearchTool } from '../tools/openaiWebSearchTool';

// Single-step research that does not suspend and requires no approval
const researchDirectStep = createStep({
  id: 'research-direct',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    query: z.string(),
    researchData: z.any(),
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const logger = mastra.getLogger();
    logger.info('[workflow:research-workflow-direct][step:research-direct] start', { query });

    try {
      const agent = mastra.getAgent('researchAgent');
      const researchPrompt = `Research the following topic thoroughly using the two-phase process: "${query}".

      Phase 1: Search for 2-3 initial queries about this topic
      Phase 2: Search for follow-up questions from the learnings (then STOP)

      At the end, OUTPUT ONLY a JSON object with the following keys (no prose):
      {
        "queries": string[],
        "searchResults": Array<{ "title"?: string; "url"?: string; "content"?: string; "relevance"?: string | boolean; "isRelevant"?: boolean; "reason"?: string }>,
        "learnings": Array<{ "learning"?: string; "followUpQuestions"?: string[]; "source"?: string }>,
        "completedQueries": string[],
        "phase"?: "initial" | "follow-up"
      }`;

      logger.info('[agent:researchAgent] generate start');
      const result = await agent.generate(
        [
          {
            role: 'user',
            content: researchPrompt,
          },
        ],
        {
          maxSteps: 40,
          experimental_output: z.object({
            queries: z.array(z.string()).default([]),
            searchResults: z
              .array(
                z
                  .object({
                    title: z.string().optional(),
                    url: z.string().optional(),
                    content: z.string().optional(),
                    relevance: z.union([z.string(), z.boolean()]).optional(),
                    isRelevant: z.boolean().optional(),
                    reason: z.string().optional(),
                  })
                  .catchall(z.any()),
              )
              .default([]),
            learnings: z
              .array(
                z.object({
                  learning: z.string().optional(),
                  followUpQuestions: z.array(z.string()).default([]).optional(),
                  source: z.string().optional(),
                }),
              )
              .default([]),
            completedQueries: z.array(z.string()).default([]),
            phase: z.string().optional(),
          }),
        },
      );

      // Prefer structured object; fallback to parsed text or plain text
      let structured: any = (result as any).object;
      if (!structured && (result as any).text) {
        try {
          structured = JSON.parse((result as any).text);
        } catch {
          // ignore non-JSON
        }
      }

      const pretty = structured
        ? JSON.stringify(structured, null, 2)
        : (result as any).text || 'No structured research data returned.';

      const summary = `Research completed on "${query}"\n\n${pretty}\n`;

      // Fallback path: if no structured data, synthesize from tools directly
      if (!structured || (!structured.searchResults && !structured.learnings)) {
        try {
          logger.info('[tool:web-search] execute from direct fallback', { query });
          const exaSearch = await (webSearchTool as any).execute({ context: { query }, mastra });
          const exaResults = (exaSearch?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;

          // Also try OpenAI web search preview and merge results
          logger.info('[tool:openai-web-search] execute from direct fallback', { query });
          const openaiSearch = await (openaiWebSearchTool as any).execute({ context: { query } });
          const oaiResults = (openaiSearch?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;

          const dedup = new Map<string, { title?: string; url?: string; content?: string }>();
          for (const r of [...exaResults, ...oaiResults]) {
            if (!r?.url) continue;
            if (!dedup.has(r.url)) dedup.set(r.url, r);
          }
          const results = Array.from(dedup.values());

          const enriched = [] as Array<{ title?: string; url?: string; content?: string; isRelevant?: boolean; reason?: string }>;
          const learnings: Array<{ learning?: string; followUpQuestions?: string[]; source?: string }> = [];

          for (const r of results) {
            try {
              const evalRes = await (evaluateResultTool as any).execute({ context: { query, result: r }, mastra });
              enriched.push({ ...r, isRelevant: !!evalRes?.isRelevant, reason: evalRes?.reason });
              // Intentionally skip learning extraction in direct fallback to simplify flow
            } catch {
              enriched.push({ ...r });
            }
          }

          structured = {
            queries: [query],
            searchResults: enriched,
            learnings,
            completedQueries: [query],
            phase: 'initial',
          } as any;

          const prettySynth = JSON.stringify(structured, null, 2);
          const summarySynth = `Research completed on "${query}"\n\n${prettySynth}\n`;

          return {
            query,
            researchData: structured,
            summary: summarySynth,
          };
        } catch {
          // fall through to return earlier summary
        }
      }

      return {
        query,
        researchData: structured ?? { rawText: (result as any).text },
        summary,
      };
    } catch (error: any) {
      return {
        query,
        researchData: { error: error.message },
        summary: `Error: ${error.message}`,
      };
    }
  },
});

// Step 2: Generate a focused report based on research results
const generateReportDirectStep = createStep({
  id: 'generate-report-direct',
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
    const logger = mastra.getLogger();
    logger.info('[workflow:research-workflow-direct][step:generate-report-direct] start', { query });
    try {
      const agent = mastra.getAgent('reportAgent');
      logger.info('[agent:reportAgent] generate start');
      const response = await agent.generate([
        {
          role: 'user',
          content: `Original user query: ${query}\n\nYou are given structured research data (JSON). Write a final report that directly answers the user's original query. Follow these rules strictly:\n- Only incorporate items from researchData.searchResults where isRelevant is true; ignore others.\n- Synthesize the key learnings into a cohesive, well-structured narrative.\n- Include a short Sources section citing titles and URLs used.\n- Keep the report tightly aligned to the original query; do not drift.\n\nResearch data (JSON):\n${JSON.stringify(researchData)}`,
        },
      ]);
      // Also return `summary` with the same content so UIs expecting
      // a summary field display the final report by default.
      return { report: response.text, summary: response.text, researchData, approved: true };
    } catch (error: any) {
      const msg = `Failed to generate report: ${error?.message || 'unknown error'}`;
      return { report: msg, summary: msg, researchData, approved: true };
    }
  },
});

export const researchWorkflowDirect = createWorkflow({
  id: 'research-workflow-direct',
  inputSchema: z.object({
    query: z.string().min(1, 'query is required'),
  }),
  outputSchema: z.object({
    researchData: z.any(),
    approved: z.boolean().default(true),
    report: z.string().optional(),
    summary: z.string().optional(),
  }),
  steps: [researchDirectStep, generateReportDirectStep],
});

researchWorkflowDirect
  .then(researchDirectStep)
  .then(generateReportDirectStep)
  .commit();
