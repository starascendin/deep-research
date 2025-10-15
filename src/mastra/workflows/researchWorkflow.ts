import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../tools/webSearchTool';
import { evaluateResultTool } from '../tools/evaluateResultTool';
import { extractLearningsTool } from '../tools/extractLearningsTool';

// Step 1: Get user query
const getUserQueryStep = createStep({
  id: 'get-user-query',
  inputSchema: z.object({
    // When provided at workflow start, this will bypass suspend
    query: z.string().describe('The query to research'),
  }),
  outputSchema: z.object({
    query: z.string(),
  }),
  resumeSchema: z.object({
    query: z.string(),
  }),
  suspendSchema: z.object({
    message: z.object({
      query: z.string(),
    }),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    console.info('[workflow:research-workflow][step:get-user-query] start', { inputData, resumeData });
    // Prefer resumeData (explicit user response), otherwise use start input
    const query = resumeData?.query ?? inputData?.query;

    if (query && query.trim().length > 0) {
      return { query };
    }

    await suspend({
      message: {
        query: 'What would you like to research?',
      },
    });

    return { query: '' };
  },
});

// Step 2: Research
const researchStep = createStep({
  id: 'research',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    researchData: z.any(),
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    console.info('[workflow:research-workflow][step:research] start', { query });

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

      console.info('[agent:researchAgent] generate start');
      const result = await agent.generate(
        [
          {
            role: 'user',
            content: researchPrompt,
          },
        ],
        {
          maxSteps: 40,
          // Lenient schema to reduce parse failures and avoid undefined object
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

      // Create a summary without accidental 'undefined'
      const summary = `Research completed on "${query}"\n\n${pretty}\n`;

      // Fallback path: if no structured data, synthesize from tools directly
      if (!structured || (!structured.searchResults && !structured.learnings)) {
        try {
          const search = await (webSearchTool as any).execute({ context: { query }, mastra });
          const results = (search?.results ?? []) as Array<{ title?: string; url?: string; content?: string }>;

          const enriched = [] as Array<{ title?: string; url?: string; content?: string; isRelevant?: boolean; reason?: string }>;
          const learnings: Array<{ learning?: string; followUpQuestions?: string[]; source?: string }> = [];

          for (const r of results) {
            try {
              const evalRes = await (evaluateResultTool as any).execute({ context: { query, result: r }, mastra });
              enriched.push({ ...r, isRelevant: !!evalRes?.isRelevant, reason: evalRes?.reason });
              // Skip learning extraction in fallback path to avoid undefined logs and simplify output
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
            researchData: structured,
            summary: summarySynth,
          };
        } catch {
          // fall through to return earlier summary
        }
      }

      return {
        researchData: structured ?? { rawText: (result as any).text },
        summary,
      };
    } catch (error: any) {
      console.log({ error });
      return {
        researchData: { error: error.message },
        summary: `Error: ${error.message}`,
      };
    }
  },
});

// Step 3: Get user approval
const approvalStep = createStep({
  id: 'approval',
  inputSchema: z.object({
    researchData: z.any(),
    summary: z.string(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    researchData: z.any(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    console.info('[workflow:research-workflow][step:approval] start', { inputKeys: Object.keys(inputData || {}) });
    if (resumeData) {
      return {
        ...resumeData,
        researchData: inputData.researchData,
      };
    }

    await suspend({
      summary: inputData.summary,
      message: `Is this research sufficient? [y/n] `,
    });
    console.info('[workflow:research-workflow][step:approval] suspended awaiting user input');

    return {
      approved: false,
      researchData: inputData.researchData,
    };
  },
});

// Define the workflow
export const researchWorkflow = createWorkflow({
  id: 'research-workflow',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    researchData: z.any(),
  }),
  steps: [getUserQueryStep, researchStep, approvalStep],
});

researchWorkflow.then(getUserQueryStep).then(researchStep).then(approvalStep).commit();
