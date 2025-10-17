import { mastra } from "../src/mastra";

async function main() {
  const workflowId = process.argv[2] || "testWorkflow01";
  const workflow = mastra.getWorkflow(workflowId);

  if (!workflow) {
    console.error(`Workflow '${workflowId}' not found.`);
    process.exit(1);
  }

  console.log("Workflow ID:", workflow.id);
  console.log("Input schema (Zod):", workflow.inputSchema);
  console.log("Output schema (Zod):", workflow.outputSchema);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
