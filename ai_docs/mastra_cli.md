---
title: "Reference: CLI Commands"
description: Documentation for the Mastra CLI to develop, build, and start your project.
---

import { Callout } from "nextra/components";

# CLI Commands

You can use the Command-Line Interface (CLI) provided by Mastra to develop, build, and start your Mastra project.

## `mastra dev`

Starts a server which exposes a [local dev playground](/docs/server-db/local-dev-playground) and REST endpoints for your agents, tools, and workflows. You can visit [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui) for an overview of all available endpoints once `mastra dev` is running.

You can also [configure the server](/docs/server-db/local-dev-playground#configuration).

### Flags

The command accepts [common flags][common-flags] and the following additional flags:

#### `--https`

Enable local HTTPS support. [Learn more](/docs/server-db/local-dev-playground#local-https).

#### `--inspect`

Start the development server in inspect mode, helpful for debugging. This can't be used together with `--inspect-brk`.

#### `--inspect-brk`

Start the development server in inspect mode and break at the beginning of the script. This can't be used together with `--inspect`.

#### `--custom-args`

Comma-separated list of custom arguments to pass to the development server. You can pass arguments to the Node.js process, e.g. `--experimental-transform-types`.

### Configs

You can set certain environment variables to modify the behavior of `mastra dev`.

#### Disable build caching

Set `MASTRA_DEV_NO_CACHE=1` to force a full rebuild rather than using the cached assets under `.mastra/`:

```bash copy
MASTRA_DEV_NO_CACHE=1 mastra dev
```

This helps when you are debugging bundler plugins or suspect stale output.

#### Limit parallelism

`MASTRA_CONCURRENCY` caps how many expensive operations run in parallel (primarily build and evaluation steps). For example:

```bash copy
MASTRA_CONCURRENCY=4 mastra dev
```

Leave it unset to let the CLI pick a sensible default for the machine.

#### Custom provider endpoints

When using providers supported by the Vercel AI SDK you can redirect requests through proxies or internal gateways by setting a base URL. For OpenAI:

```bash copy
OPENAI_API_KEY=<your-api-key> \
OPENAI_BASE_URL=https://openrouter.example/v1 \
mastra dev
```

For Anthropic:

```bash copy
ANTHROPIC_API_KEY=<your-api-key> \
ANTHROPIC_BASE_URL=https://anthropic.internal \
mastra dev
```

These are forwarded by the AI SDK and work with any `openai()` or `anthropic()` calls.

## `mastra build`

The `mastra build` command bundles your Mastra project into a production-ready Hono server. [Hono](https://hono.dev/) is a lightweight, type-safe web framework that makes it easy to deploy Mastra agents as HTTP endpoints with middleware support.

Under the hood Mastra's Rollup server locates your Mastra entry file and bundles it to a production-ready Hono server. During that bundling it tree-shakes your code and generates source maps for debugging.

The output in `.mastra` can be deployed to any cloud server using [`mastra start`](#mastra-start).

If you're deploying to a [serverless platform](/docs/deployment/serverless-platforms) you need to install the correct deployer in order to receive the correct output in `.mastra`.

It accepts [common flags][common-flags].

### Configs

You can set certain environment variables to modify the behavior of `mastra build`.

#### Limit parallelism

For CI or when running in resource constrained environments you can cap how many expensive tasks run at once by setting `MASTRA_CONCURRENCY`.

```bash copy
MASTRA_CONCURRENCY=2 mastra build
```

## `mastra start`

<Callout type="info">
You need to run `mastra build` before using `mastra start`.
</Callout>

Starts a local server to serve your built Mastra application in production mode. By default, [OTEL Tracing](/docs/observability/otel-tracing) is enabled.

### Flags

The command accepts [common flags][common-flags] and the following additional flags:

#### `--dir`

The path to your built Mastra output directory. Defaults to `.mastra/output`.

#### `--no-telemetry`

Disable the [OTEL Tracing](/docs/observability/otel-tracing).

## `mastra lint`

The `mastra lint` command validates the structure and code of your Mastra project to ensure it follows best practices and is error-free.

It accepts [common flags][common-flags].

## `mastra scorers`

The `mastra scorers` command provides management capabilities for evaluation scorers that measure the quality, accuracy, and performance of AI-generated outputs.

Read the [Scorers overview](/docs/scorers/overview) to learn more.

### `add`

Add a new scorer to your project. You can use an interactive prompt:

```bash copy
mastra scorers add
```

Or provide a scorer name directly:

```bash copy
mastra scorers add answer-relevancy
```

Use the [`list`](#list) command to get the correct ID.

### `list`

List all available scorer templates. Use the ID for the `add` command.

## `mastra init`

The `mastra init` command initializes Mastra in an existing project. Use this command to scaffold the necessary folders and configuration without generating a new project from scratch.

### Flags

The command accepts the following additional flags:

#### `--default`

Creates files inside `src` using OpenAI. It also populates the `src/mastra` folders with example code.

#### `--dir`

The directory where Mastra files should be saved to. Defaults to `src`.

#### `--components`

Comma-separated list of components to add. For each component a new folder will be created. Defaults to `['agents', 'tools', 'workflows']`.

#### `--llm`

Default model provider. Choose from: `"openai" | "anthropic" | "groq" | "google" | "cerebras" | "mistral"`.

#### `--llm-api-key`

The API key for your chosen model provider. Will be written to an environment variables file (`.env`).

#### `--example`

If enabled, example code is written to the list of components (e.g. example agent code).

#### `--no-example`

Do not include example code. Useful when using the `--default` flag.

#### `--mcp`

Configure your code editor with Mastra's MCP server. Choose from: `"cursor" | "cursor-global" | "windsurf" | "vscode"`.

## Common flags

### `--dir`

**Available in:** `dev`, `build`, `lint`

The path to your Mastra folder. Defaults to `src/mastra`.

### `--debug`

**Available in:** `dev`, `build`

Enable verbose logging for Mastra's internals. Defaults to `false`.

### `--env`

**Available in:** `dev`, `start`

Custom environment variables file to include. By default, includes `.env.development`, `.env.local`, and `.env`.

### `--root`

**Available in:** `dev`, `build`, `lint`

Path to your root folder. Defaults to `process.cwd()`.

### `--tools`

**Available in:** `dev`, `build`, `lint`

Comma-separated list of tool paths to include. Defaults to `src/mastra/tools`.

## Global flags

Use these flags to get information about the `mastra` CLI.

### `--version`

Prints the Mastra CLI version and exits.

### `--help`

Prints help message and exits.

## Telemetry

By default, Mastra collects anonymous information about your project like your OS, Mastra version or Node.js version. You can read the [source code](https://github.com/mastra-ai/mastra/blob/main/packages/cli/src/analytics/index.ts) to check what's collected.

You can opt out of the CLI analytics by setting an environment variable:

```bash copy
MASTRA_TELEMETRY_DISABLED=1
```

You can also set this while using other `mastra` commands:

```bash copy
MASTRA_TELEMETRY_DISABLED=1 mastra dev
```

[common-flags]: #common-flags