import { createRestAdapter } from '@agentic-shop/adapters';
import { serve } from '@hono/node-server';
import { createServer } from './app';
import { EnvError, readEnv, type ServerEnv } from './env';
import { loadNearestEnvFile } from './load-env-file';
import { createModel } from './model';

loadNearestEnvFile();

let env: ServerEnv;
try {
  env = readEnv();
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  console.error(`\n${error.message}\n`);
  process.exit(1);
}

const app = createServer({
  model: createModel({ provider: env.provider, model: env.model, apiKey: env.apiKey }),
  store: createRestAdapter({ baseUrl: env.storeApiBaseUrl, apiKey: env.storeApiKey }),
  allowedOrigins: env.allowedOrigins,
  rateLimitPerMinute: env.rateLimitPerMinute,
  trustProxy: env.trustProxy,
  agentConfig: env.storeName ? { storeName: env.storeName } : {},
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  // Configuration summary for the operator. Secrets are never printed.
  console.log(`chat server listening on http://localhost:${info.port}`);
  console.log(`  provider: ${env.provider}, model: ${env.model}`);
  console.log(`  store: ${env.storeApiBaseUrl}`);
  console.log(`  allowed origins: ${env.allowedOrigins.join(', ')}`);
  console.log(`  rate limit: ${env.rateLimitPerMinute}/minute per IP and per session`);
});
