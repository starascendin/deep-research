import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Process query with basicAgent
const basicAgentStep = createStep({
  id: 'basic-agent-query',
  inputSchema: z.object({
    query: z.string().describe('The query to send to the basic agent'),
  }),
  outputSchema: z.object({
    response: z.string(),
    usage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
    toolCalls: z.array(z.any()).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const logger = mastra.getLogger();
    logger.info('[workflow:basic-agent-workflow][step:basic-agent-query] start', { query });

    try {
      const agent = mastra.getAgent('basicAgent');

      const result = await agent.generate([
        {
          role: 'user',
          content: query,
        },
      ]);

      const response = result.text || 'No response received';

      logger.info('[workflow:basic-agent-workflow][step:basic-agent-query] completed');

      // Extract only essential data
      return {
        response,
        usage: result.usage ? {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        } : undefined,
        toolCalls: Array.isArray((result as any).toolCalls)
          ? (result as any).toolCalls.map((tc: any) => ({
              toolName: tc?.payload?.toolName,
              args: tc?.payload?.args,
            }))
          : [],
      };
    } catch (error: any) {
      logger.error('[workflow:basic-agent-workflow][step:basic-agent-query] error', { message: error?.message, stack: error?.stack });
      return {
        response: `Error: ${error.message}`,
      };
    }
  },
});

// Define the workflow
export const basicAgentWorkflow = createWorkflow({
  id: 'basic-agent-workflow',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    usage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
    toolCalls: z.array(z.any()).optional(),
  }),
  steps: [basicAgentStep],
});

basicAgentWorkflow.then(basicAgentStep).commit();
