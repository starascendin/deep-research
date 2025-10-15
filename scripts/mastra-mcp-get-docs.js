// Simple script to connect to Mastra's MCP Docs Server, list resources/tools, and fetch one doc
// Usage: node scripts/mastra-mcp-get-docs.js [optional-search-term]

import { MCPClient } from "@mastra/mcp";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();

  const mcp = new MCPClient({
    servers: {
      mastra: {
        // Uses stdio via npx to launch the docs server
        command: "npx",
        args: ["-y", "@mastra/mcp-docs-server"],
        // Uncomment for verbose server logs
        // env: { DEBUG: "1" },
      },
    },
    timeout: 60000,
  });

  try {
    console.log("Connecting to Mastra MCP Docs Server…\n");

    // List tools exposed by the docs server (useful for search, etc.)
    const tools = await mcp.getTools();
    const toolNames = Object.keys(tools);
    console.log(`Tools available (${toolNames.length}):`);
    console.log(toolNames.map((n) => `- ${n}`).join("\n"));
    console.log("");

    // List resources the docs server exposes
    const resourcesByServer = await mcp.resources.list();
    const resources = resourcesByServer.mastra || [];
    console.log(`Resources available from 'mastra' (${resources.length}):`);
    for (const r of resources.slice(0, 20)) {
      console.log(`- ${r.name || r.uri} (${r.mimeType || "unknown"}) -> ${r.uri}`);
    }
    console.log("");

    // Try to pick a good doc resource: prefer docs-related URIs, else first
    let candidate = resources.find((r) => /docs|reference|getting-started/i.test(`${r.name} ${r.uri}`));
    if (!candidate && query) {
      candidate = resources.find((r) => new RegExp(query, "i").test(`${r.name} ${r.uri}`));
    }
    if (!candidate) candidate = resources[0];

    if (!candidate) {
      console.log("No resources found to read.");
      return;
    }

    console.log(`Reading resource: ${candidate.name || candidate.uri}`);
    const read = await mcp.resources.read("mastra", candidate.uri);
    const first = (read && read.contents && read.contents[0]) || {};
    const text = first.text || first.blob || JSON.stringify(first, null, 2);

    // Print a preview of the content
    console.log("\n----- Resource Content (preview) -----\n");
    const preview = typeof text === "string" ? text : String(text);
    console.log(preview.length > 4000 ? preview.slice(0, 4000) + "\n…(truncated)…" : preview);
    console.log("\n----- End Preview -----\n");
  } catch (err) {
    console.error("Error using Mastra MCP Docs Server:", err?.stack || err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      await mcp.disconnect();
    } catch {}
  }
}

main();

