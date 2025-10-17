Invoking Agents and Workflows in Mastra Cloud

This guide shows how to run the repository’s cloud-hosted agents and workflows using the provided zscripts (TypeScript) and the OpenAPI streaming script (Python). It covers prerequisites, environment setup, commands, and common troubleshooting tips.

Prerequisites
- Node.js 20.9+ (package engines enforce this)
- npm dependencies installed: `npm install`
- Mastra Cloud API key available
- Optional: OpenAI/Exa API keys for tools used by agents/workflows

Environment Setup
- Create `.env` at the repo root (see `.env.example`):
  - `MASTRA_API_KEY` set to your API key
  - `MASTRA_ENFORCE_API_KEY` to `true` if your server requires API key auth
  - Optional `MASTRA_CLOUD_URL` to override the default sample URL
  - Tool keys as needed: `OPENAI_API_KEY`, `EXA_API_KEY`, etc.

Quick Reference
- Agents (cloud): `npm run agent:cloud -- --query "<question>"`
- Workflows (cloud): `npm run workflow:cloud -- --query "<topic>"`
- Workflows (local): `npm run workflow:local -- --query "<topic>"`
- Python OpenAPI stream: `python3 scripts/stream_research.py --server https://<mastra-host> --workflow-id researchWorkflow --query "<topic>" [--auto-approve]`

Option A: zscripts via npm scripts
- Run the cloud research agent (streaming):
  - `npm run agent:cloud -- --query "What is OpenAI o3?"`
- Run the cloud research workflow test runner (auto-approve by default):
  - `npm run workflow:cloud -- --query "Compare o4 vs o3"`
- Run the local research workflow:
  - `npm run workflow:local -- --query "Latest NVIDIA news"`
- Test OpenAI web search tool:
  - `npm run websearch:test -- --query "Semaglutide diabetes"`

Notes
- These scripts look for `MASTRA_API_KEY` in the environment and send it as `x-api-key`.
- You may set `MASTRA_CLOUD_URL` to point to your deployment. If unset, the scripts use a sample URL embedded in each file.

Option B: zscripts directly with tsx
- You can call the TypeScript scripts directly with `npx tsx`:
  - Research agent (streaming):
    - `npx tsx zscripts/run-research-agent-cloud.ts --query "What is OpenAI o3?"`
  - Basic agent (streaming):
    - `npx tsx zscripts/run-basic-agent-cloud.ts --query "Weather in San Francisco"`
  - Basic agent (non‑streaming generate):
    - `npx tsx zscripts/run-basic-agent-generate.ts --query "Weather in Tokyo in fahrenheit"`
  - Basic workflow (cloud):
    - `npx tsx zscripts/run-basic-workflow-cloud.ts --query "What is 2+2?"`

What these do
- Initialize `MastraClient` with `baseUrl` and `x-api-key` header
- Get an agent or workflow by ID (e.g., `researchAgent`, `basicAgent`, `researchWorkflow`, `basicAgentWorkflow`)
- For agents:
  - Use `.stream(...)` to stream responses (collects text chunks)
  - Or `.generate(...)` for a single non‑streaming response
- For workflows:
  - Create a run, start it, and wait for completion (via `startAsync` or polling)

Option C: Python OpenAPI streaming client
- The Python script discovers endpoints via the server’s OpenAPI and streams workflow output.
- Example:
  - `python3 scripts/stream_research.py --server https://<mastra-host> --workflow-id researchWorkflow --query "Latest OpenAI news" --auto-approve`
- Behavior:
  - Creates a run for the workflow
  - Starts the vNext stream (server caches chunks)
  - Observes the stream and optionally auto‑approves when the workflow suspends for approval
- Tips:
  - Use `--auto-approve` for unattended runs
  - For local servers, default is `--server http://localhost:4111`

Agent and Workflow IDs
- Defined in `src/mastra/index.ts` under `agents` and `workflows`.
- Common IDs used by these scripts:
  - Agents: `researchAgent`, `basicAgent`
  - Workflows: `researchWorkflow`, `basicAgentWorkflow`

Authentication
- The server protects `/api/*` with API key middleware when enabled.
- Client requests must include header `x-api-key: <MASTRA_API_KEY>`.
- See `ai_docs/API_KEY_AUTH.MD` for details, including enforcement flags and readiness checks.

Troubleshooting
- 401 Unauthorized
  - Ensure `MASTRA_API_KEY` matches the cloud’s configured key
  - Set `MASTRA_ENFORCE_API_KEY=true` on the server if you expect auth enforcement
- CORS or browser dashboard
  - Server sets CORS headers and can accept Mastra Cloud JWTs when enabled; for script usage, use `x-api-key`
- Hanging workflow run
  - Use the Python script’s `--auto-approve` or the TS workflow test runner’s auto‑approval to bypass approval pauses
  - If using `.start()` instead of `.startAsync`, the TS script will poll until completion
- Wrong base URL
  - Set `MASTRA_CLOUD_URL` or pass `--server` to the Python script

Appendix: Useful Environment Keys
- `MASTRA_API_KEY` / `API_KEY`: API key checked against `x-api-key`
- `MASTRA_CLOUD_URL`: Optional cloud base URL override
- `MASTRA_ENFORCE_API_KEY`: `true` to require API key on `/api/*`
- `READINESS_CHECK_PATH`: Unauthenticated readiness route (defaults to `/api`)
- Tool keys: `OPENAI_API_KEY`, `EXA_API_KEY`, etc.

