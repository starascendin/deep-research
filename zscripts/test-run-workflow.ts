import { mastra } from "../src/mastra";

// Test runner for the research workflow with suspend/resume handling
// Usage examples:
//   npx tsx zscripts/test-run-workflow.ts "What is OpenAI o3?"
//   npx tsx zscripts/test-run-workflow.ts --query "What is OpenAI o3?" --approve
//   npx tsx zscripts/test-run-workflow.ts --query "Compare o4 vs o3" --deny

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

  const workflow = mastra.getWorkflow("researchWorkflow");
  const run = await workflow.createRunAsync();

  // Start with an initial query; get-user-query will bypass suspend now
  let result = await run.start({ inputData: { query: initialQuery } });
  console.log("After start:\n", JSON.stringify({ status: result.status, suspended: (result as any).suspended, steps: result.steps?.["research"] ? { research: result.steps["research"].status } : undefined }, null, 2));

  // If approval step suspended, optionally auto-approve/deny
  if (result?.status === "suspended" && autoApprove !== undefined) {
    const approval = autoApprove ? true : false;
    result = await run.resume({ resumeData: { approved: approval } });
    console.log(`After ${approval ? "approval" : "denial"}:\n`, JSON.stringify(result, null, 2));
  }

  // Log final result (success or failed)
  console.log("Final result:\n", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

