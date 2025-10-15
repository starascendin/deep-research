import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { xaiWebSearchTool } from '../tools/xaiWebSearchTool';

// Lightweight orchestrator that ALWAYS calls the xAI search tool
// and returns a normalized JSON object of results.
export const xaiSearchAgent = new Agent({
  name: 'xai_searchagent',
  description: 'Agent that uses xAI Live Search to fetch up-to-date information and normalize results',
  instructions: `
You are a search agent. You MUST use the provided tool 'xai-web-search' to perform live search for the user's query.

STRICT RULES:
- First, call the 'xai-web-search' tool with the user query exactly as provided.
- when you outputting the response, summarize the results from the tool call, but make sure you retain citations and urls

  `,
  // Use a lightweight model to orchestrate tool-calling and formatting
  model: openai('gpt-4.1-mini'),
  tools: {
    'xai-web-search': xaiWebSearchTool,
  },
});

