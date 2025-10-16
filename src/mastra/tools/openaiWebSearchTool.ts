import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * OpenAI Web Search tool
 * Uses OpenAI web_search (or preview) via the AI SDK to fetch up-to-date info.
 * Returns only the useful info: text response, sources, and citations.
 */
export const openaiWebSearchTool = createTool({
  id: 'openai-web-search',
  description: 'Search the web using OpenAI web_search (or preview) and return the useful info (text, sources, citations)',
  inputSchema: z.object({
    query: z.string().describe('The search query to run'),
  }),
  execute: async ({ context, mastra }) => {
    const { query } = context as { query: string };
    const logger = mastra?.getLogger();
    logger?.info('[tool:openai-web-search] invoked', { query });
    try {
      const anyOpenAI: any = openai;

      // Prefer the official web_search tool if available, else fall back to preview.
      const tools: Record<string, any> = {};
      if (anyOpenAI.tools?.webSearch) {
        tools.web_search = anyOpenAI.tools.webSearch({
          // optional example defaults; callers can extend this tool later if needed
          searchContextSize: 'high',
        });
      } else if (anyOpenAI.tools?.webSearchPreview) {
        tools.web_search_preview = anyOpenAI.tools.webSearchPreview({});
      }

      const result = await generateText({
        model: openai('gpt-5-mini'),
        prompt: query,
        tools,
        // Force using the web_search tool when available
        toolChoice: tools.web_search ? { type: 'tool', toolName: 'web_search' } : undefined,
      });
      // Extract useful info: text response and sources (citations may not be present)
      const text = result.text || '';
      const sources = (result as any).sources || [];
      return {
        text,
        sources,
        citations: [],
        usage: {
          inputTokens: result.usage?.inputTokens || 0,
          outputTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        },
      };
    } catch (error: any) {
      return { 
        error: error?.message || 'OpenAI web search failed',
        text: '',
        sources: [],
        citations: [],
      };
    }
  },
});
