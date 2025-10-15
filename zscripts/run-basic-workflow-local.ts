import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mastra } from '../src/mastra/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from project root
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Trigger the basicAgentWorkflow locally (in-process).
 *
 * Usage:
 *   npx tsx zscripts/run-basic-workflow-local.ts "What's the weather in Tokyo in fahrenheit?"
 *   npx tsx zscripts/run-basic-workflow-local.ts --query "What is 2+2?"
 *
 * This script runs the workflow directly using the local Mastra instance,
 * without making HTTP requests to a server.
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

  console.log('🧠 Workflow: basicAgentWorkflow (local)');
  console.log('📤 Query:', userQuery);

  try {
    console.log('\n🔄 Starting workflow execution...');

    const workflow = mastra.getWorkflow('basicAgentWorkflow');
    if (!workflow) {
      console.error('❌ Workflow "basicAgentWorkflow" not found');
      process.exit(1);
    }

    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: { query: userQuery } });

    console.log('\n✅ Workflow completed');
    console.log('\n📝 Full Result:\n');
    console.log(JSON.stringify(result, null, 2));

    // Extract the response from the workflow output
    if (result?.results?.response) {
      console.log('\n💬 Agent Response:\n');
      console.log(result.results.response);
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
