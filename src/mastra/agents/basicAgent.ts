import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherTool } from '../tools/weatherTool';

// Lightweight general-purpose agent showcasing tool usage
export const basicAgent = new Agent({
  name: 'basic-agent',
  description: 'A simple agent that can answer questions and fetch current weather via a tool.',
  instructions: `You are a concise, helpful assistant. When the user asks about weather in a city, call the weather tool with { city } and optionally { unit }. If the user doesn't specify unit, default to celsius. When not about weather, answer briefly.`,
  model: openai('gpt-4.1-mini'),
  tools: {
    weatherTool,
  },
});

