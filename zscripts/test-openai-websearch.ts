/**
 * Test script for OpenAI Web Search tools using AI SDK v5.
 *
 * Usage examples:
 *   npx tsx zscripts/test-openai-websearch.ts --query "What happened in San Francisco last week?"
 *   npx tsx zscripts/test-openai-websearch.ts --tool web_search --query "Latest NVIDIA news"
 *   npx tsx zscripts/test-openai-websearch.ts --tool web_search_preview --model gpt-5-mini --query "Semaglutide diabetes"
 *
 * Flags:
 *   --query <text>     Required. The user query to search.
 *   --tool <name>      Optional. One of: web_search, web_search_preview, both. Default: both.
 *   --model <id>       Optional. OpenAI model id. Default: gpt-5-mini.
 */
import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

type ToolChoice = 'web_search' | 'web_search_preview' | 'both';

function parseArgs(): { query: string; tool: ToolChoice; model: string } {
  const argv = process.argv.slice(2);
  let query = '';
  let tool: ToolChoice = 'both';
  let model = 'gpt-5-mini';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query' && i + 1 < argv.length) {
      query = argv[++i];
    } else if (a === '--tool' && i + 1 < argv.length) {
      const t = argv[++i] as ToolChoice;
      if (t === 'web_search' || t === 'web_search_preview' || t === 'both') tool = t;
    } else if (a === '--model' && i + 1 < argv.length) {
      model = argv[++i];
    }
  }

  if (!query) {
    console.error('Error: --query is required');
    process.exit(1);
  }

  return { query, tool, model };
}

function normalizeSources(sources: any): Array<{ title?: string; url?: string; snippet?: string }> {
  const out: Array<{ title?: string; url?: string; snippet?: string }> = [];
  const arr = Array.isArray(sources) ? sources : [];
  for (const s of arr) {
    const url = s?.url || s?.href || '';
    if (!url) continue;
    out.push({ title: s?.title, url, snippet: s?.snippet || s?.text || s?.description });
  }
  return out;
}

async function runOne(toolName: 'web_search' | 'web_search_preview', model: string, query: string) {
  const anyOpenAI: any = openai;
  const toolsConfig: Record<string, any> = {};

  if (toolName === 'web_search') {
    if (!anyOpenAI.tools?.webSearch) {
      return { tool: toolName, model, error: 'web_search tool not available in this @ai-sdk/openai version' };
    }
    toolsConfig.web_search = anyOpenAI.tools.webSearch({});
  } else if (toolName === 'web_search_preview') {
    if (!anyOpenAI.tools?.webSearchPreview) {
      return { tool: toolName, model, error: 'web_search_preview tool not available in this @ai-sdk/openai version' };
    }
    toolsConfig.web_search_preview = anyOpenAI.tools.webSearchPreview({});
  }

  try {
    const { text, sources } = await generateText({
      model: openai(model),
      prompt: `Search the web for up-to-date information relevant to: "${query}". Provide a concise answer with clear citations.`,
      tools: toolsConfig,
    });

    const normalized = normalizeSources(sources as any);
    // Provide basic fallbacks if no structured sources
    let fallbackUrls: string[] = [];
    if (normalized.length === 0 && text) {
      const urlRegex = /https?:\/\/[^\s)]+/g;
      fallbackUrls = Array.from(new Set(text.match(urlRegex) || []));
    }

    return {
      tool: toolName,
      model,
      text,
      sources: normalized,
      fallbackUrls,
    };
  } catch (err: any) {
    return { tool: toolName, model, error: err?.message || String(err) };
  }
}

async function main() {
  const { query, tool, model } = parseArgs();

  if (tool === 'both') {
    const [ws, wsp] = await Promise.all([
      runOne('web_search', model, query),
      runOne('web_search_preview', model, query),
    ]);
    console.log(JSON.stringify({ query, results: [ws, wsp] }, null, 2));
  } else if (tool === 'web_search') {
    const res = await runOne('web_search', model, query);
    console.log(JSON.stringify({ query, results: [res] }, null, 2));
  } else {
    const res = await runOne('web_search_preview', model, query);
    console.log(JSON.stringify({ query, results: [res] }, null, 2));
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});

