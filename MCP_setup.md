

https://mcp.exa.ai/mcp?api_key=20f79417-8898-4f2e-9356-3265d2c11e40&profile=scary-chickadee-zwxpia


```
// Unix/Mac
import { MCPClient } from "@mastra/mcp";
 
const mcp = new MCPClient({
  servers: {
    sequentialThinking: {
      command: "npx",
      args: [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@smithery-ai/server-sequential-thinking",
        "--config",
        "{}",
      ],
    },
  },
});
```