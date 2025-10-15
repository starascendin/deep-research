import { MastraClient } from '@mastra/client-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Trigger the basicAgentWorkflow on the cloud deployment.
 *
 * Usage:
 *   npx tsx zscripts/run-basic-workflow-cloud.ts "What's the weather in Tokyo in fahrenheit?"
 *   npx tsx zscripts/run-basic-workflow-cloud.ts --query "What is 2+2?"
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
  const userQuery = (query || 'What is the current weather in London?').trim();

  // Read API key for authentication
  const apiKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error('❌ Error: MASTRA_API_KEY (or API_KEY) not found in .env file');
    process.exit(1);
  }

  // Initialize the Mastra client pointing to the cloud deployment
  const baseUrl = process.env.MASTRA_CLOUD_URL || 'https://hundreds-tinkling-teacher.mastra.cloud';
  const mastraClient = new MastraClient({
    baseUrl,
    headers: {
      'x-api-key': apiKey,
    },
  });

  console.log('🔐 Connecting to cloud deployment with API key authentication');
  console.log(`🌐 URL: ${baseUrl}`);
  console.log('🧠 Workflow: basicAgentWorkflow (cloud)');
  console.log('📤 Query:', userQuery);

  try {
    console.log('\n🔄 Starting workflow execution...');

    const workflow = mastraClient.getWorkflow('basicAgentWorkflow');
    const run = await workflow.createRunAsync();

    // Start the workflow and wait for completion
    const startFn = (run as any).startAsync || (run as any).start;
    let result: any;

    if (startFn === (run as any).startAsync) {
      // If startAsync is supported, use it for automatic completion wait
      result = await (run as any).startAsync({ inputData: { query: userQuery } });
    } else {
      // Otherwise use start and poll for completion
      await (run as any).start({ inputData: { query: userQuery } });

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        try {
          result = await (workflow as any).runExecutionResult?.(run.runId);
          if (result?.status === 'success' || result?.status === 'failed') {
            break;
          }
        } catch (err) {
          // Continue polling
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!result) {
        console.error('❌ Timeout waiting for workflow completion');
        process.exit(1);
      }
    }

    console.log('\n✅ Workflow completed');
    console.log('\n📝 Full Result:\n');
    console.log(JSON.stringify(result, null, 2));

    // Extract the response from the workflow output
    if (result?.result?.response || result?.results?.response) {
      console.log('\n💬 Agent Response:\n');
      console.log(result.result?.response || result.results?.response);

      if (result?.result?.usage || result?.results?.usage) {
        const usage = result.result?.usage || result.results?.usage;
        console.log('\n📊 Token Usage:');
        console.log(`  Input: ${usage.inputTokens}`);
        console.log(`  Output: ${usage.outputTokens}`);
        console.log(`  Total: ${usage.totalTokens}`);
      }

      if (result?.result?.toolCalls || result?.results?.toolCalls) {
        const toolCalls = result.result?.toolCalls || result.results?.toolCalls;
        if (toolCalls && toolCalls.length > 0) {
          console.log('\n🔧 Tool Calls:');
          toolCalls.forEach((tc: any, idx: number) => {
            console.log(`  ${idx + 1}. ${tc.toolName}`);
            console.log(`     Args: ${JSON.stringify(tc.args)}`);
          });
        }
      }
    }
  } catch (error: any) {
    console.error('\n❌ Error executing workflow:');
    console.error('Error type:', typeof error);
    console.error('Error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
