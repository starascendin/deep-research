import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

import { exaMcpWebSearchAgent } from './exaMcpWebSearchAgent';
import { xaiSearchAgent } from './xaiSearchAgent';
import { exaMcpClient } from '../mcp/exaMcpClient';
import { xaiWebSearchTool } from '../tools/xaiWebSearchTool';

export const websearchNetworkAgent = new Agent({
  name: 'websearch_network_agent',
  description:
    'Routing agent for web research that coordinates Exa MCP web search and xAI Live Search. Uses Exa MCP for breadth and xAI for live, up-to-date results.',
  instructions: `
You are a web research routing agent with two specialized sub-agents:
- exa_mcp_websearch: Uses Exa via MCP to perform general and authoritative web searches.
- xai_searchagent: Uses xAI Live Search for the most current, up-to-date information.

Routing Guidance:
- For broad research, discovery, and authoritative sources, use exa_mcp_websearch.
- For breaking news or time-sensitive topics, supplement with xai_searchagent.
- When combining results, cite titles + URLs succinctly.
- Keep answers concise and focused on the user's request.
`,
  model: openai('gpt-4.1-mini'),
  agents: {
    exaMcpWebSearchAgent,
    xaiSearchAgent,
  },
  tools: async () => {
    try {
      // Merge Exa MCP tools with direct xAI web search tool
      const mcpTools = await exaMcpClient.getTools();
      return {
        ...mcpTools,
        'xai-web-search': xaiWebSearchTool,
      } as any;
    } catch {
      return { 'xai-web-search': xaiWebSearchTool } as any;
    }
  },
  // Minimal memory for network coordination and termination criteria.
  memory: new Memory({
    storage: new LibSQLStore({ url: 'file:../mastra.db' }),
  }),
});
