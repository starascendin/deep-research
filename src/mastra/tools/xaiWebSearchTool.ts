import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

/**
 * xAI Live Search tool (AI SDK)
 * Uses the @ai-sdk/xai provider and generateText with providerOptions.xai.searchParameters
 * Normalizes output to { text, sources, results } similar to other web search tools.
 */
export const xaiWebSearchTool = createTool({
  id: 'xai-web-search',
  description:
    'Search the web using xAI Live Search via the AI SDK provider and return normalized results with text and sources',
  inputSchema: z.object({
    query: z.string().describe('The search query to run'),
  }),
  execute: async ({ context, mastra }) => {
    const { query } = context as { query: string };
    const logger = mastra?.getLogger();
    logger?.info('[tool:xai-web-search] invoked', { query });

    try {
      if (!process.env.XAI_API_KEY) {
        logger?.error('Error: XAI_API_KEY not found in environment variables');
        return { results: [], error: 'Missing API key' };
      }

      const { text, sources, finishReason, usage } = await generateText({
        model: xai('grok-3-latest'),
        prompt: query,
        providerOptions: {
          xai: {
            searchParameters: {
              mode: 'on', // 'auto' | 'on' | 'off'
              returnCitations: true,
              // You can add more parameters here (fromDate, toDate, maxSearchResults, sources, ...)
            },
          },
        },
      });
      // Return raw AI SDK outputs without normalization or fallbacks.
      return { text, sources, finishReason, usage } as any;
    } catch (error: any) {
      logger?.error('Error calling xAI live search (AI SDK)', { error: error?.message });
      return { results: [], error: error?.message || 'xAI search failed' };
    }
  },
});
