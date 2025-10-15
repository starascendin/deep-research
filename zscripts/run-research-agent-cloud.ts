import { MastraClient } from '@mastra/client-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Invoke the cloud-hosted research agent directly.
 *
 * Usage:
 *   npx tsx zscripts/run-research-agent-cloud.ts "What is OpenAI o3?"
 *   npx tsx zscripts/run-research-agent-cloud.ts --query "Compare o4 vs o3"
 *
 * Env:
 *   MASTRA_API_KEY=...           API key for the Mastra server
 *   MASTRA_CLOUD_URL=...         Optional. Defaults to the example cloud URL
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { query?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--query' && args[i + 1]) {
      out.query = args[++i];
    } else if (!a.startsWith('--') && !out.query) {
      out.query = a;
    }
  }
  return out;
}

async function main() {
  const { query } = parseArgs();
  const prompt = (query || 'Summarize the latest OpenAI news and capabilities for o3.').trim();

  const apiKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error('❌ Missing MASTRA_API_KEY (or API_KEY) in environment');
    process.exit(1);
  }

  const baseUrl = process.env.MASTRA_CLOUD_URL || 'https://hundreds-tinkling-teacher.mastra.cloud';
  const client = new MastraClient({
    baseUrl,
    headers: { 'x-api-key': apiKey },
  });

  console.log('🔐 Using API key auth');
  console.log(`🌐 URL: ${baseUrl}`);
  console.log(`🧠 Agent: researchAgent`);

  const agent = client.getAgent('researchAgent');

  console.log('\n📤 Sending request...');
  console.log('Query:', prompt);

  try {
    // Prefer streaming to ensure we wait until completion even if server uses tool-calls
    console.log('Calling agent.stream() and waiting for completion...');

    const messages = [
      { role: 'system', content: 'You are an expert research assistant.' },
      { role: 'user', content: prompt },
    ];

    const resp = await agent.stream(messages as any, { maxSteps: 16 } as any);

    let text = '';
    // Accumulate stream chunks until the end
    await (resp as any).processDataStream({
      onChunk: (chunk: any) => {
        // Collect text regardless of delta or full
        if (chunk?.type === 'text-delta' && chunk?.payload?.text) {
          text += chunk.payload.text;
        }
        if (chunk?.type === 'text' && chunk?.payload?.text) {
          text += chunk.payload.text;
        }
      },
    });

    console.log('\n✅ Completed');
    if (text.trim()) {
      console.log('\n📝 Text response:\n');
      console.log(text);
    } else {
      console.log('\n⚠️ Stream produced no text.');
    }
  } catch (error: any) {
    console.error('\n❌ Error calling agent:');
    console.error('Error type:', typeof error);
    console.error('Error:', error);
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
