import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const evaluateResultTool = createTool({
  id: 'evaluate-result',
  description: 'Evaluate if a search result is relevant to the research query',
  inputSchema: z.object({
    query: z.string().describe('The original research query'),
    result: z
      .object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      })
      .describe('The search result to evaluate'),
  }),
  execute: async ({ context, mastra }) => {
    try {
      const { query, result } = context;
      console.log('Evaluating result', { context });

      const evaluationAgent = mastra!.getAgent('evaluationAgent');

      const response = await evaluationAgent.generate(
        [
          {
            role: 'user',
            content: `Evaluate whether this search result is relevant and will help answer the query: "${query}".

        Search result:
        Title: ${result.title}
        URL: ${result.url}
        Content snippet: ${result.content.substring(0, 500)}...

        Respond with a JSON object containing:
        - isRelevant: boolean indicating if the result is relevant
        - reason: brief explanation of your decision`,
          },
        ],
        {
          experimental_output: z.object({
            isRelevant: z.boolean(),
            reason: z.string(),
          }),
        },
      );

      return response.object;
    } catch (error) {
      console.error('Error evaluating result:', error);
      return {
        isRelevant: false,
        reason: 'Error in evaluation',
      };
    }
  },
});
