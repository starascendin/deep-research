import { MastraClient } from "@mastra/client-js";
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Test runner for the research workflow against cloud deployment
// Usage examples:
//   npx tsx src/test-run-workflow-cloud.ts "What is OpenAI o3?"
//   npx tsx src/test-run-workflow-cloud.ts --query "What is OpenAI o3?" --approve
//   npx tsx src/test-run-workflow-cloud.ts --query "Compare o4 vs o3" --deny

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

  // Check for JWT secret
  const jwtSecret = process.env.MASTRA_JWT_SECRET;
  if (!jwtSecret) {
    console.error("❌ Error: MASTRA_JWT_SECRET not found in .env file");
    process.exit(1);
  }

  // Generate JWT token dynamically
  const jwtToken = jwt.sign(
    {
      sub: 'test-user',
      iat: Math.floor(Date.now() / 1000),
    },
    jwtSecret,
    {
      algorithm: 'HS256',
    }
  );

  // Initialize the Mastra client pointing to the cloud deployment with JWT auth
  const mastraClient = new MastraClient({
    baseUrl: "https://hundreds-tinkling-teacher.mastra.cloud",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  });

  console.log("🔐 Connecting to cloud deployment with JWT authentication");
  console.log("🌐 URL: https://hundreds-tinkling-teacher.mastra.cloud\n");

  const workflow = mastraClient.getWorkflow("researchWorkflow");
  const run = await workflow.createRunAsync();

  // Start with an initial query
  console.log(`Starting workflow with query: "${initialQuery}"\n`);
  let result = await run.start({ inputData: { query: initialQuery } });
  console.log("After start:\n", JSON.stringify({
    status: result.status,
    suspended: (result as any).suspended,
    steps: result.steps?.["research"]
      ? { research: result.steps["research"].status }
      : undefined
  }, null, 2));

  // If approval step suspended, optionally auto-approve/deny
  if (result?.status === "suspended" && autoApprove !== undefined) {
    const approval = autoApprove ? true : false;
    console.log(`\n${approval ? "Approving" : "Denying"} the research query...\n`);
    result = await run.resume({ resumeData: { approved: approval } });
    console.log(`After ${approval ? "approval" : "denial"}:\n`, JSON.stringify(result, null, 2));
  }

  // Log final result (success or failed)
  console.log("\nFinal result:\n", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
