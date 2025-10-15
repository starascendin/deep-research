import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * OpenAI Web Search Preview tool
 * Uses OpenAI Responses API built-in web search tool to fetch up-to-date info.
 * Returns results in the same shape as other web search tools used in this repo.
 */
export const openaiWebSearchTool = createTool({
  id: 'openai-web-search',
  description: 'Search the web using OpenAI web_search (or preview) and return normalized results with text and sources',
  inputSchema: z.object({
    query: z.string().describe('The search query to run'),
  }),
  execute: async ({ context }) => {
    const { query } = context as { query: string };
    console.info('[tool:openai-web-search] invoked', { query });
    try {
      const anyOpenAI: any = openai;
      const toolsConfig: Record<string, any> = {};
      if (anyOpenAI.tools?.webSearch) toolsConfig.web_search = anyOpenAI.tools.webSearch({});
      if (anyOpenAI.tools?.webSearchPreview) toolsConfig.web_search_preview = anyOpenAI.tools.webSearchPreview({});

      const { text, sources } = await generateText({
        model: openai('gpt-5-mini'),
        prompt: `Search the web for up-to-date information relevant to: "${query}". Provide a concise answer with clear citations.`,
        tools: toolsConfig,
      });

      // Normalize sources to our expected result shape
      const normalizedSources: Array<{ title?: string; url?: string; snippet?: string }> = [];
      const processedResults: Array<{ title?: string; url?: string; content?: string }> = [];

      const srcArr = Array.isArray((sources as any)) ? (sources as any) : [];
      for (const s of srcArr) {
        const url = s?.url || s?.href || '';
        const title = s?.title || url || 'Source';
        const snippet = s?.snippet || s?.text || s?.description || '';
        if (typeof url === 'string' && url.length > 0) {
          normalizedSources.push({ title, url, snippet });
          processedResults.push({ title, url, content: snippet });
        }
      }

      // Fallbacks when sources are not provided:
      if (processedResults.length === 0 && typeof text === 'string' && text.length > 0) {
        // Try to extract URLs from the text
        const urlRegex = /https?:\/\/[^\s)]+/g;
        const found = Array.from(new Set(text.match(urlRegex) || []));
        if (found.length > 0) {
          for (const u of found.slice(0, 10)) {
            processedResults.push({ title: u, url: u, content: 'Referenced by OpenAI web search summary' });
          }
        } else {
          // As a last resort, include a pseudo-source entry with a stable URL
          processedResults.push({ title: 'OpenAI Web Search Summary', url: 'oai://summary', content: text });
          normalizedSources.push({ title: 'OpenAI Web Search Summary', url: 'oai://summary', snippet: text });
        }
      }

      return { text, sources: normalizedSources, results: processedResults };
    } catch (error: any) {
      return { results: [], error: error?.message || 'OpenAI web search failed' };
    }
  },
});
