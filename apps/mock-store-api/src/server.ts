import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 4000);
const publicUrl = process.env.MOCK_STORE_PUBLIC_URL ?? `http://localhost:${port}`;
const apiKey = process.env.STORE_API_KEY?.trim() ? process.env.STORE_API_KEY.trim() : undefined;

const app = createApp({ publicUrl, apiKey });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mock-store-api listening on http://localhost:${info.port}`);
  if (apiKey) console.log('STORE_API_KEY is set: requests must send it as a Bearer token.');
});
