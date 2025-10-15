import { MastraClient } from '@mastra/client-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from project root
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Invoke the cloud-hosted basicAgent using the non-streaming generate endpoint.
 *
 * Usage:
 *   npx tsx zscripts/run-basic-agent-generate.ts "What's the weather in Tokyo in fahrenheit?"
 *   npx tsx zscripts/run-basic-agent-generate.ts --query "Weather in San Francisco"
 *
 * Env:
 *   MASTRA_API_KEY=...    API key for the Mastra server
 *   MASTRA_CLOUD_URL=...  Optional. Your Mastra Cloud base URL
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
  const prompt = (query || 'What is the current weather in London?').trim();

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
  console.log(`🧠 Agent: basicAgent`);

  const agent = client.getAgent('basicAgent');

  console.log('\n📤 Sending request...');
  console.log('Query:', prompt);

  try {
    console.log('Calling agent.generate() and waiting for response...');

    const messages = [
      { role: 'system', content: 'You are a concise, helpful assistant.' },
      { role: 'user', content: prompt },
    ];

    const response = await agent.generate(messages as any, { maxSteps: 8 } as any);

    console.log('\n✅ Completed');
    console.log('\n📝 Response:\n');
    console.log(JSON.stringify(response, null, 2));

    // Extract text from response if available
    if (response?.text) {
      console.log('\n📄 Text content:\n');
      console.log(response.text);
    } else if (response?.messages) {
      console.log('\n💬 Messages:\n');
      console.log(JSON.stringify(response.messages, null, 2));
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
