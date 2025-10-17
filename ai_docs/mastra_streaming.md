---
title: "About Mastra | Mastra Docs"
description: "Mastra is an all-in-one framework for building AI-powered applications and agents with a modern TypeScript stack."
---

import YouTube from "@/components/youtube";

# About Mastra

From the team behind Gatsby, Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack.

It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

<YouTube id="8o_Ejbcw5s8" />

## Why Mastra?

Purpose-built for TypeScript and designed around established AI patterns, Mastra gives you everything you need to build great AI applications out-of-the-box.

Some highlights include:

- [**Model routing**](/models) - Connect to 40+ providers through one standard interface. Use models from OpenAI, Anthropic, Gemini, and more.

- [**Agents**](/docs/agents/overview) - Build autonomous agents that use LLMs and tools to solve open-ended tasks. Agents reason about goals, decide which tools to use,  and iterate internally until the model emits a final answer or an optional stopping condition is met.

- [**Workflows**](/docs/workflows/overview) - When you need explicit control over execution, use Mastra's graph-based workflow engine to orchestrate complex multi-step processes. Mastra workflows use an intuitive syntax for control flow (`.then()`, `.branch()`, `.parallel()`).

- [**Human-in-the-loop**](/docs/workflows/suspend-and-resume) - Suspend an agent or workflow and await user input or approval before resuming. Mastra uses [storage](/docs/server-db/storage) to remember execution state, so you can pause indefinitely and resume where you left off.

- **Context management** - Give your agents the right context at the right time. Provide [conversation history](/docs/memory/conversation-history), [retrieve](/docs/rag/overview) data from your sources (APIs, databases, files), and add human-like [working](/docs/memory/working-memory) and [semantic](/docs/memory/semantic-recall) memory so your agents behave coherently. 

- **Integrations** - Bundle agents and workflows into existing React, Next.js, or Node.js apps, or ship them as standalone endpoints. When building UIs, integrate with agentic libraries like Vercel's AI SDK UI and CopilotKit to bring your AI assistant to life on the web.

- **Production essentials** - Shipping reliable agents takes ongoing insight, evaluation, and iteration. With built-in [evals](/docs/evals/overview) and [observability](/docs/observability/overview), Mastra gives you the tools to observe, measure, and refine continuously.


## What can you build?

- AI-powered applications that combine language understanding, reasoning, and action to solve real-world tasks.

- Conversational agents for customer support, onboarding, or internal queries.

- Domain-specific copilots for coding, legal, finance, research, or creative work.

- Workflow automations that trigger, route, and complete multi-step processes.

- Decision-support tools that analyse data and provide actionable recommendations.

Explore real-world examples in our [case studies](/blog/category/case-studies) and [community showcase](/showcase).


## Get started

Follow the [Installation guide](/docs/getting-started/installation) for step-by-step setup with the CLI or a manual install.

If you're new to AI agents, check out our [templates](/docs/getting-started/templates), [course](/course), and [YouTube videos](https://youtube.com/@mastra-ai) to start building with Mastra today.

We can't wait to see what you build ✌️