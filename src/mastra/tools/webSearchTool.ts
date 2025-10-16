import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Exa from 'exa-js';
import 'dotenv/config';

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information on a specific query and return summarized content',
  inputSchema: z.object({
    query: z.string().describe('The search query to run (can be a URL for hydration)'),
    // When true, skip summarization and return raw/truncated content. Useful for hydration.
    skipSummarization: z.boolean().optional().default(false),
    // Optional override for number of results to fetch (defaults to 3, or 1 for hydration)
    numResults: z.number().int().positive().optional(),
  }),
  execute: async ({ context, mastra }) => {
    const { query, skipSummarization = false } = context as { query: string; skipSummarization?: boolean; numResults?: number };
    const logger = mastra?.getLogger();
    logger?.info('[tool:web-search] invoked', { query });

    try {
      if (!process.env.EXA_API_KEY) {
        const logger = mastra?.getLogger();
        logger?.error('Error: EXA_API_KEY not found in environment variables');
        return { results: [], error: 'Missing API key' };
      }

      const desiredNumResults = (context as any)?.numResults ?? (skipSummarization ? 1 : 3);
      logger?.info('[tool:web-search] searching', { query, numResults: desiredNumResults, skipSummarization });
      const { results } = await exa.searchAndContents(query, {
        // livecrawl: 'always',
        numResults: desiredNumResults,
      });

      if (!results || results.length === 0) {
        logger?.info('[tool:web-search] no results');
        return { results: [], error: 'No results found' };
      }

      if (!skipSummarization) {
        logger?.info('[tool:web-search] results found, summarizing', { count: results.length });
      } else {
        logger?.info('[tool:web-search] results found, skipping summarization', { count: results.length });
      }

      // Get the summarization agent (only used if skipSummarization is false)
      const summaryAgent = skipSummarization ? undefined : mastra!.getAgent('webSummarizationAgent');

      // Process each result with summarization
      const processedResults = [];
      for (const result of results) {
        try {
          // If skipping summarization, just pass through raw/truncated content
          if (skipSummarization) {
            processedResults.push({
              title: result.title || '',
              url: result.url,
              content: result.text ? result.text.substring(0, 2000) : 'No content available',
            });
            continue;
          }

          // Skip if content is too short or missing
          if (!result.text || result.text.length < 100) {
            processedResults.push({
              title: result.title || '',
              url: result.url,
              content: result.text || 'No content available',
            });
            continue;
          }

          // Summarize the content
          logger?.info('[agent:webSummarizationAgent] generate start');
          const summaryResponse = await summaryAgent!.generate([
            {
              role: 'user',
              content: `Please summarize the following web content for research query: "${query}"

Title: ${result.title || 'No title'}
URL: ${result.url}
Content: ${result.text.substring(0, 8000)}...

Provide a concise summary that captures the key information relevant to the research query.`,
            },
          ]);

          processedResults.push({
            title: result.title || '',
            url: result.url,
            content: summaryResponse.text,
          });

          logger?.info('[tool:web-search] summary complete', { title: result.title || result.url });
        } catch (summaryError) {
          const logger = mastra?.getLogger();
          logger?.error('Error summarizing content', { error: (summaryError as any)?.message });
          // Fallback to truncated original content
          processedResults.push({
            title: result.title || '',
            url: result.url,
            content: result.text ? result.text.substring(0, 500) + '...' : 'Content unavailable',
          });
        }
      }

      return {
        results: processedResults,
      };
    } catch (error) {
      const logger = mastra?.getLogger();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger?.error('Error searching the web', { error: errorMessage });
      return {
        results: [],
        error: errorMessage,
      };
    }
  },
});
