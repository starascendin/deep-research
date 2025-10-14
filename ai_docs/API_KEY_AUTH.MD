API Key Middleware Auth
This project replaces JWT auth with a simple API key middleware that protects Mastra API endpoints.

Server configuration (src/mastra/index.ts):

```ts
export const mastra = new Mastra({
  // ...
  server: {
    middleware: [
      {
        path: '/api/*',
        handler: async (c, next) => {
          const configuredKey = process.env.MASTRA_API_KEY || process.env.API_KEY;
          if (!configuredKey) {
            return new Response('Server misconfigured: missing MASTRA_API_KEY', { status: 500 });
          }
          const providedKey = c.req.header('x-api-key');
          if (!providedKey || providedKey !== configuredKey) {
            return new Response('Unauthorized', { status: 401 });
          }
          await next();
        },
      },
    ],
  },
});
```

Usage from clients:

```ts
const client = new MastraClient({
  baseUrl: 'https://<your-mastra-host>',
  headers: {
    'x-api-key': process.env.MASTRA_API_KEY!,
  },
});
```

Notes
- Protects only `/api/*` routes; the readiness path remains public (defaults to `/api`, configurable via `READINESS_CHECK_PATH`).
- Configure the key via `MASTRA_API_KEY` (or `API_KEY`). See `.env.example`.
- Local dev: when `NODE_ENV` is not `production`, the middleware is disabled. To force auth in dev, set `MASTRA_ENFORCE_API_KEY=true`.
