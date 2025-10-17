---
title: "Agent Networks | Agents | Mastra Docs"
description: Learn how to coordinate multiple agents, workflows, and tools using agent networks for complex, non-deterministic task execution.
---

# Agent Networks

Agent networks in Mastra coordinate multiple agents, workflows, and tools to handle tasks that aren't clearly defined upfront but can be inferred from the user's message or context. A top-level **routing agent** (a Mastra agent with other agents, workflows, and tools configured) uses an LLM to interpret the request and decide which primitives (sub-agents, workflows, or tools) to call, in what order, and with what data.

## When to use networks

Use networks for complex tasks that require coordination across multiple primitives. Unlike workflows, which follow a predefined sequence, networks rely on LLM reasoning to interpret the request and decide what to run.

## Core principles

Mastra agent networks operate using these principles:

- Memory is required when using `.network()` and is used to store task history and determine when a task is complete.
- Primitives are selected based on their descriptions. Clear, specific descriptions improve routing. For workflows and tools, the input schema helps determine the right inputs at runtime.
- If multiple primitives have overlapping functionality, the agent favors the more specific one, using a combination of schema and descriptions to decide which to run.

## Creating an agent network

An agent network is built around a top-level routing agent that delegates tasks to agents, workflows, and tools defined in its configuration. Memory is configured on the routing agent using the `memory` option, and `instructions` define the agent's routing behavior.

```typescript {22-23,26,29} filename="src/mastra/agents/routing-agent.ts" showLineNumbers copy
  import { openai } from "@ai-sdk/openai";
  import { Agent } from "@mastra/core/agent";
  import { Memory } from "@mastra/memory";
  import { LibSQLStore } from "@mastra/libsql";

  import { researchAgent } from "./research-agent";
  import { writingAgent } from "./writing-agent";

  import { cityWorkflow } from "../workflows/city-workflow";
  import { weatherTool } from "../tools/weather-tool";

  export const routingAgent = new Agent({
    name: "routing-agent",
    instructions: `
      You are a network of writers and researchers.
      The user will ask you to research a topic.
      Always respond with a complete report—no bullet points.
      Write in full paragraphs, like a blog post.
      Do not answer with incomplete or uncertain information.`,
    model: openai("gpt-4o-mini"),
    agents: {
      researchAgent,
      writingAgent
    },
    workflows: {
      cityWorkflow
    },
    tools: {
      weatherTool
    },
    memory: new Memory({
      storage: new LibSQLStore({
        url: "file:../mastra.db"
      })
    })
  });
  ```

### Writing descriptions for network primitives

When configuring a Mastra agent network, each primitive (agent, workflow, or tool) needs a clear description to help the routing agent decide which to use. The routing agent uses each primitive's description and schema to determine what it does and how to use it. Clear descriptions and well-defined input and output schemas improve routing accuracy.

#### Agent descriptions

Each agent in a network should include a clear `description` that explains what the agent does.

```typescript filename="src/mastra/agents/research-agent.ts" showLineNumbers
export const researchAgent = new Agent({
  name: "research-agent",
  description: `This agent gathers concise research insights in bullet-point form.
    It's designed to extract key facts without generating full
    responses or narrative content.`,
  // ...
});
```
```typescript filename="src/mastra/agents/writing-agent.ts" showLineNumbers
export const writingAgent = new Agent({
  name: "writing-agent",
  description: `This agent turns researched material into well-structured
    written content. It produces full-paragraph reports with no bullet points,
    suitable for use in articles, summaries, or blog posts.`,
  // ...
});
```

#### Workflow descriptions

Workflows in a network should include a `description` to explain their purpose, along with `inputSchema` and `outputSchema` to describe the expected data.

```typescript filename="src/mastra/workflows/city-workflow.ts" showLineNumbers
export const cityWorkflow = createWorkflow({
  id: "city-workflow",
  description: `This workflow handles city-specific research tasks.
    It first gathers factual information about the city, then synthesizes
    that research into a full written report. Use it when the user input
    includes a city to be researched.`,
  inputSchema: z.object({
    city: z.string()
  }),
  outputSchema: z.object({
    text: z.string()
  })
  //...
})
```

#### Tool descriptions

Tools in a network should include a `description` to explain their purpose, along with `inputSchema` and `outputSchema` to describe the expected data.

```typescript filename="src/mastra/tools/weather-tool.ts" showLineNumbers
export const weatherTool = createTool({
  id: "weather-tool",
  description: ` Retrieves current weather information using the wttr.in API.
    Accepts a city or location name as input and returns a short weather summary.
    Use this tool whenever up-to-date weather data is requested.
  `,
  inputSchema: z.object({
    location: z.string()
  }),
  outputSchema: z.object({
    weather: z.string()
  }),
  // ...
});
```

## Calling agent networks

Call a Mastra agent network using `.network()` with a user message. The method returns a stream of events that you can iterate over to track execution progress and retrieve the final result.

### Agent example

In this example, the network interprets the message and would route the request to both the `researchAgent` and `writingAgent` to generate a complete response.

```typescript showLineNumbers copy
const result = await routingAgent.network("Tell me three cool ways to use Mastra");

for await (const chunk of result) {
  console.log(chunk.type);
  if (chunk.type === "network-execution-event-step-finish") {
    console.log(chunk.payload.result);
  }
}
```

#### Agent output

The following `chunk.type` events are emitted during this request:

```text
routing-agent-start
routing-agent-end
agent-execution-start
agent-execution-event-start
agent-execution-event-step-start
agent-execution-event-text-start
agent-execution-event-text-delta
agent-execution-event-text-end
agent-execution-event-step-finish
agent-execution-event-finish
agent-execution-end
network-execution-event-step-finish
```

## Workflow example

In this example, the routing agent recognizes the city name in the message and runs the `cityWorkflow`. The workflow defines steps that call the `researchAgent` to gather facts, then the `writingAgent` to generate the final text.

```typescript showLineNumbers copy
const result = await routingAgent.network("Tell me some historical facts about London");

for await (const chunk of result) {
  console.log(chunk.type);
  if (chunk.type === "network-execution-event-step-finish") {
    console.log(chunk.payload.result);
  }
}
```

#### Workflow output

The following `chunk.type` events are emitted during this request:

```text
routing-agent-end
workflow-execution-start
workflow-execution-event-workflow-start
workflow-execution-event-workflow-step-start
workflow-execution-event-workflow-step-result
workflow-execution-event-workflow-finish
workflow-execution-end
routing-agent-start
network-execution-event-step-finish
```

### Tool example

In this example, the routing agent skips the `researchAgent`, `writingAgent`, and `cityWorkflow`, and calls the `weatherTool` directly to complete the task.

```typescript showLineNumbers copy
const result = await routingAgent.network("What's the weather in London?");

for await (const chunk of result) {
  console.log(chunk.type);
  if (chunk.type === "network-execution-event-step-finish") {
    console.log(chunk.payload.result);
  }
}
```

#### Tool output

The following `chunk.type` events are emitted during this request:

```text
routing-agent-start
routing-agent-end
tool-execution-start
tool-execution-end
network-execution-event-step-finish
```

## Related

- [Agent Memory](./agent-memory.mdx)
- [Workflows Overview](../workflows/overview.mdx)
- [Runtime Context](../server-db/runtime-context.mdx)