import { MCPClient } from '@mastra/mcp';

// Single URL configuration for Exa MCP via SSE
const exaMcpSseUrl = process.env.EXA_MCP_SSE_URL;

// Create a dedicated MCP client for Exa.
// If URL is missing, we still export a client with no servers so the app can start; tools() will be empty.
export const exaMcpClient = new MCPClient({
  id: 'exa-mcp-client',
  servers: exaMcpSseUrl
    ? {
        exa: {
          url: new URL(exaMcpSseUrl),
        },
      }
    : {},
});
