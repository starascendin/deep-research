---
title: "MCP Overview | Tools & MCP | Mastra Docs"
description: Learn about the Model Context Protocol (MCP), how to use third-party tools via MCPClient, connect to registries, and share your own tools using MCPServer.
---

import { Tabs } from "nextra/components";

# MCP Overview

Mastra supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), an open standard for connecting AI agents to external tools and resources. It serves as a universal plugin system, enabling agents to call tools regardless of language or hosting environment.

Mastra can also be used to author MCP servers, exposing agents, tools, and other structured resources via the MCP interface. These can then be accessed by any system or agent that supports the protocol.

Mastra currently supports two MCP classes:

1. **`MCPClient`**: Connects to one or many MCP servers to access their tools, resources, prompts, and handle elicitation requests.
2. **`MCPServer`**: Exposes Mastra tools, agents, workflows, prompts, and resources to MCP compatible clients.

## Getting started

To use MCP, install the required dependency:

```bash
npm install @mastra/mcp@latest
```

## Configuring `MCPClient`

The `MCPClient` connects Mastra primitives to external MCP servers, which can be local packages (invoked using `npx`) or remote HTTP(S) endpoints. Each server must be configured with either a `command` or a `url`, depending on how it's hosted.

```typescript filename="src/mastra/mcp/test-mcp-client.ts" showLineNumbers copy
import { MCPClient } from "@mastra/mcp";

export const testMcpClient = new MCPClient({
  id: "test-mcp-client",
  servers: {
    wikipedia: {
      command: "npx",
      args: ["-y", "wikipedia-mcp"]
    },
    weather: {
      url: new URL(`https://server.smithery.ai/@smithery-ai/national-weather-service/mcp?api_key=${process.env.SMITHERY_API_KEY}`)
    },
  }
});
```

> See [MCPClient](../../reference/tools/mcp-client.mdx) for a full list of configuration options.

## Using `MCPClient` with an agent

To use tools from an MCP server in an agent, import your `MCPClient` and call `.getTools()` in the `tools` parameter. This loads from the defined MCP servers, making them available to the agent.

```typescript {4,16} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { testMcpClient } from "../mcp/test-mcp-client";

export const testAgent = new Agent({
  name: "Test Agent",
  description: "You are a helpful AI assistant",
  instructions: `
      You are a helpful assistant that has access to the following MCP Servers.
      - Wikipedia MCP Server
      - US National Weather Service

      Answer questions using the information you find using the MCP Servers.`,
  model: openai("gpt-4o-mini"),
  tools: await testMcpClient.getTools()
});
```
> See the [Agent Class](../../reference/agents/agent.mdx) for a full list of configuration options.

## Configuring `MCPServer`

To expose agents, tools, and workflows from your Mastra application to external systems over HTTP(S) use the `MCPServer` class. This makes them accessible to any system or agent that supports the protocol.

```typescript filename="src/mastra/mcp/test-mcp-server.ts" showLineNumbers copy
import { MCPServer } from "@mastra/mcp";

import { testAgent } from "../agents/test-agent";
import { testWorkflow } from "../workflows/test-workflow";
import { testTool } from "../tools/test-tool";

export const testMcpServer = new MCPServer({
  id: "test-mcp-server",
  name: "Test Server",
  version: "1.0.0",
  agents: { testAgent },
  tools: { testTool },
  workflows: { testWorkflow }
});
```

> See [MCPServer](../../reference/tools/mcp-server.mdx) for a full list of configuration options.

## Registering an `MCPServer`

To make an MCP server available to other systems or agents that support the protocol, register it in the main `Mastra` instance using `mcpServers`.

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core/mastra";

import { testMcpServer } from "./mcp/test-mcp-server";

export const mastra = new Mastra({
  // ...
  mcpServers: { testMcpServer }
});
```

## Static and dynamic tools

`MCPClient` offers two approaches to retrieving tools from connected servers, suitable for different application architectures:

| Feature           | Static Configuration (`await mcp.getTools()`)  | Dynamic Configuration (`await mcp.getToolsets()`)     |
| :---------------- | :---------------------------------------------| :--------------------------------------------------- |
| **Use Case**      | Single-user, static config (e.g., CLI tool)    | Multi-user, dynamic config (e.g., SaaS app)           |
| **Configuration**  | Fixed at agent initialization                 | Per-request, dynamic                                 |
| **Credentials**   | Shared across all uses                        | Can vary per user/request                            |
| **Agent Setup**   | Tools added in `Agent` constructor            | Tools passed in `.generate()` or `.stream()` options |

### Static tools

Use the `.getTools()` method to fetch tools from all configured MCP servers. This is suitable when configuration (such as API keys) is static and consistent across users or requests. Call it once and pass the result to the `tools` property when defining your agent.

> See [getTools()](../../reference/tools/mcp-client.mdx#gettools) for more information.

```typescript {8} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { testMcpClient } from "../mcp/test-mcp-client";

export const testAgent = new Agent({
  // ...
  tools: await testMcpClient.getTools()
});
```

### Dynamic tools

Use the `.getToolsets()` method when tool configuration may vary by request or user, such as in a multi-tenant system where each user provides their own API key. This method returns toolsets that can be passed to the `toolsets` option in the agent's `.generate()` or `.stream()` calls.

```typescript {5-16,21} showLineNumbers copy
import { MCPClient } from "@mastra/mcp";
import { mastra } from "./mastra";

async function handleRequest(userPrompt: string, userApiKey: string) {
  const userMcp = new MCPClient({
    servers: {
      weather: {
        url: new URL("http://localhost:8080/mcp"),
        requestInit: {
          headers: {
            Authorization: `Bearer ${userApiKey}`
          }
        }
      }
    }
  });

  const agent = mastra.getAgent("testAgent");

  const response = await agent.generate(userPrompt, {
    toolsets: await userMcp.getToolsets()
  });

  await userMcp.disconnect();

  return Response.json({
    data: response.text
  });
}
```

> See [getToolsets()](../../reference/tools/mcp-client.mdx#gettoolsets) for more information.



## Connecting to an MCP registry

MCP servers can be discovered through registries. Here's how to connect to some popular ones using `MCPClient`:


{/*
LLM CONTEXT: This Tabs component shows how to connect to different MCP (Model Context Protocol) registries.
Each tab demonstrates the configuration for a specific MCP registry service (mcp.run, Composio.dev, Smithery.ai).
The tabs help users understand how to connect to various MCP server providers and their different authentication methods.
Each tab shows the specific URL patterns and configuration needed for that registry service.
*/}

<Tabs items={["Klavis AI", "mcp.run", "Composio.dev", "Smithery.ai", "Ampersand"]}>
  <Tabs.Tab>
    [Klavis AI](https://klavis.ai) provides hosted, enterprise-authenticated, high-quality MCP servers.

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        salesforce: {
          url: new URL("https://salesforce-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
        },
        hubspot: {
          url: new URL("https://hubspot-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
        },
      },
    });
    ```

    Klavis AI offers enterprise-grade authentication and security for production deployments.

    For more details on how to integrate Mastra with Klavis, check out their [documentation](https://docs.klavis.ai/documentation/ai-platform-integration/mastra).

  </Tabs.Tab>
  <Tabs.Tab>
    [mcp.run](https://www.mcp.run/) provides pre-authenticated, managed MCP servers. Tools are grouped into Profiles, each with a unique, signed URL.

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        marketing: { // Example profile name
          url: new URL(process.env.MCP_RUN_SSE_URL!), // Get URL from mcp.run profile
        },
      },
    });
    ```

    > **Important:** Treat the mcp.run SSE URL like a password. Store it securely, for example, in an environment variable.
    > ```bash filename=".env"
    > MCP_RUN_SSE_URL=https://www.mcp.run/api/mcp/sse?nonce=...
    > ```

  </Tabs.Tab>
  <Tabs.Tab>
    [Composio.dev](https://composio.dev) offers a registry of [SSE-based MCP servers](https://mcp.composio.dev). You can use the SSE URL generated for tools like Cursor directly.

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        googleSheets: {
          url: new URL("https://mcp.composio.dev/googlesheets/[private-url-path]"),
        },
        gmail: {
          url: new URL("https://mcp.composio.dev/gmail/[private-url-path]"),
        },
      },
    });
    ```

    Authentication with services like Google Sheets often happens interactively through the agent conversation.

    *Note: Composio URLs are typically tied to a single user account, making them best suited for personal automation rather than multi-tenant applications.*

  </Tabs.Tab>
  <Tabs.Tab>
    [Smithery.ai](https://smithery.ai) provides a registry accessible via their CLI.

    ```typescript
    // Unix/Mac
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        sequentialThinking: {
          command: "npx",
          args: [
            "-y",
            "@smithery/cli@latest",
            "run",
            "@smithery-ai/server-sequential-thinking",
            "--config",
            "{}",
          ],
        },
      },
    });
    ```

    ```typescript
    // Windows
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        sequentialThinking: {
          command: "npx",
          args: [
            "-y",
            "@smithery/cli@latest",
            "run",
            "@smithery-ai/server-sequential-thinking",
            "--config",
            "{}",
          ],
        },
      },
    });
    ```

  </Tabs.Tab>
    <Tabs.Tab>

    [Ampersand](https://withampersand.com?utm_source=mastra-docs) offers an [MCP Server](https://docs.withampersand.com/mcp) that allows you to connect your agent to 150+ integrations with SaaS products like Salesforce, Hubspot, and Zendesk.


    ```typescript

    // MCPClient with Ampersand MCP Server using SSE
    export const mcp = new MCPClient({
        servers: {
        "@amp-labs/mcp-server": {
          "url": `https://mcp.withampersand.com/v1/sse?${new URLSearchParams({
            apiKey: process.env.AMPERSAND_API_KEY,
            project: process.env.AMPERSAND_PROJECT_ID,
            integrationName: process.env.AMPERSAND_INTEGRATION_NAME,
            groupRef: process.env.AMPERSAND_GROUP_REF
          })}`
        }
      }
    });

    ```

    ```typescript
    // If you prefer to run the MCP server locally:

    import { MCPClient } from "@mastra/mcp";

    // MCPClient with Ampersand MCP Server using stdio transport
    export const mcp = new MCPClient({
        servers: {
          "@amp-labs/mcp-server": {
            command: "npx",
            args: [
              "-y",
              "@amp-labs/mcp-server@latest",
              "--transport",
              "stdio",
              "--project",
              process.env.AMPERSAND_PROJECT_ID,
              "--integrationName",
              process.env.AMPERSAND_INTEGRATION_NAME,
              "--groupRef",
              process.env.AMPERSAND_GROUP_REF, // optional
            ],
            env: {
              AMPERSAND_API_KEY: process.env.AMPERSAND_API_KEY,
            },
          },
        },
    });
    ```

    As an alternative to MCP, Ampersand's AI SDK also has an adapter for Mastra, so you can [directly import Ampersand tools](https://docs.withampersand.com/ai-sdk#use-with-mastra) for your agent to access.

  </Tabs.Tab>
</Tabs>

## Related

- [Using Tools and MCP](../agents/using-tools-and-mcp.mdx)
- [MCPClient](../../reference/tools/mcp-client.mdx)
- [MCPServer](../../reference/tools/mcp-server.mdx)
