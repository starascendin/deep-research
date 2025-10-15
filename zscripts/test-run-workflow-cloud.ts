import { MastraClient } from "@mastra/client-js";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Test runner for the research workflow against cloud deployment
// Usage examples:
//   npx tsx zscripts/test-run-workflow-cloud.ts "What is OpenAI o3?"
//   npx tsx zscripts/test-run-workflow-cloud.ts --query "What is OpenAI o3?" --approve
//   npx tsx zscripts/test-run-workflow-cloud.ts --query "Compare o4 vs o3" --deny

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { query?: string; approve?: boolean; deny?: boolean } = {};

  // Support --query "..." or first arg as the query
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--query" && args[i + 1]) {
      out.query = args[i + 1];
      i++;
      continue;
    }
    if (a === "--approve") {
      out.approve = true;
      continue;
    }
    if (a === "--deny") {
      out.deny = true;
      continue;
    }
    // If not a flag, treat as query (first non-flag only)
    if (!a.startsWith("--") && !out.query) {
      out.query = a;
    }
  }

  return out;
}

async function main() {
  const { query, approve, deny } = parseArgs();
  const initialQuery = query?.trim() || "OpenAI o3 model announcement and capabilities";
  const autoApprove = deny ? false : approve !== false; // default approve unless --deny

  // Read API key for simple header-based auth
  const apiKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.error("❌ Error: MASTRA_API_KEY (or API_KEY) not found in .env file");
    process.exit(1);
  }

  // Initialize the Mastra client pointing to the cloud deployment with API key auth
  const baseUrl = process.env.MASTRA_CLOUD_URL || "https://hundreds-tinkling-teacher.mastra.cloud";
  const mastraClient = new MastraClient({
    baseUrl,
    headers: {
      'x-api-key': apiKey,
    },
  });

  console.log("🔐 Connecting to cloud deployment with API key authentication");
  console.log(`🌐 URL: ${baseUrl}\n`);

  const workflow = mastraClient.getWorkflow("researchWorkflow");
  const run = await workflow.createRunAsync();

  // Watcher to auto-approve on suspend and resolve on completion
  const waitForFinal = () => new Promise<any>((resolve) => {
    let resolved = false;
    try {
      (run as any).watch?.(async (record: any) => {
        const status = record?.payload?.workflowState?.status || record?.status;
        const normalized = typeof status === 'string' ? status.toUpperCase() : undefined;

        if (normalized === 'SUSPENDED' && autoApprove !== undefined) {
          const approval = !!autoApprove;
          console.log(`\nDetected suspended state. ${approval ? 'Auto-approving' : 'Auto-denying'}...\n`);
          try {
            await (run as any).resume?.({ resumeData: { approved: approval } });
          } catch {}
        }

        if (!resolved && (normalized === 'COMPLETED' || normalized === 'FAILED')) {
          resolved = true;
          try {
            const final = await (workflow as any).runExecutionResult?.(run.runId);
            resolve(final ?? record);
          } catch {
            resolve(record);
          }
        }
      });
    } catch {
      // no-op
    }
    // Fallback polling in case watch is not available
    const poll = async () => {
      if (resolved) return;
      try {
        const final = await (workflow as any).runExecutionResult?.(run.runId);
        if (final) {
          resolved = true;
          resolve(final);
          return;
        }
      } catch {}
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 15000);
  });

  // Start with an initial query
  console.log(`Starting workflow with query: "${initialQuery}"\n`);

  const startFn = (run as any).startAsync || (run as any).start;
  let startResult: any;
  if (startFn === (run as any).startAsync) {
    // If supported, wait until completion via startAsync
    startResult = await (run as any).startAsync({ inputData: { query: initialQuery } });
  } else {
    // Fire-and-watch pattern
    await (run as any).start({ inputData: { query: initialQuery } });
    startResult = await waitForFinal();
  }

  console.log("\nFinal result:\n", JSON.stringify(startResult, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

