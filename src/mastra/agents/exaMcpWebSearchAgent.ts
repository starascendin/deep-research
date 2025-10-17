import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { exaMcpClient } from '../mcp/exaMcpClient';

export const exaMcpWebSearchAgent = new Agent({
  name: 'exa_mcp_websearch',
  description: 'Agent that uses the Exa MCP server to search the web and retrieve up-to-date information',
  instructions: `
You are a research agent with access to an MCP Server exposing Exa web search tools.

STRICT RULES:
- Use the Exa MCP tools to search for the most relevant, recent sources for the user query.
- Prefer authoritative sources and primary references.
- Provide concise answers with inline citations (titles + URLs) when appropriate.
  `,
  model: openai('gpt-4.1-mini'),
  // Use a dynamic tools loader so startup doesn't require env to be present.
  tools: async () => {
    try {
      return await exaMcpClient.getTools();
    } catch {
      return {} as any;
    }
  },
});

