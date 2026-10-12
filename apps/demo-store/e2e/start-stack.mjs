// Starts the whole demo with scripted replies instead of an AI model:
// mock store, scripted chat server and the built storefront.
// Used by the end-to-end tests and by `pnpm demo:scripted`. Needs `pnpm build` first.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const ports = {
  store: process.env.E2E_STORE_PORT ?? '4100',
  chat: process.env.E2E_CHAT_PORT ?? '3101',
  web: process.env.E2E_WEB_PORT ?? '3100',
};
const storeUrl = `http://localhost:${ports.store}`;
const chatUrl = `http://localhost:${ports.chat}`;
const webUrl = `http://localhost:${ports.web}`;

if (!existsSync(here('../.next/BUILD_ID'))) {
  console.error('The storefront is not built yet. Run `pnpm build` in the repository root first.');
  process.exit(1);
}

const children = [];

function stop() {
  for (const child of children) child.kill();
}

function start(name, command, env) {
  const child = spawn(command, {
    cwd: here('..'),
    env: { ...process.env, ...env },
    shell: true,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    stop();
    process.exit(code ?? 1);
  });
  children.push(child);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start('store', `node "${here('../../mock-store-api/dist/server.js')}"`, {
  PORT: ports.store,
  MOCK_STORE_PUBLIC_URL: storeUrl,
  STORE_API_KEY: '',
});
start('chat', 'pnpm exec tsx e2e/chat-server.ts', {
  PORT: ports.chat,
  STORE_API_BASE_URL: storeUrl,
  ALLOWED_ORIGINS: webUrl,
});
start('web', `pnpm exec next start --port ${ports.web}`, {
  STORE_API_BASE_URL: storeUrl,
  STORE_API_KEY: '',
  CHAT_API_URL: chatUrl,
});

console.log(`\nScripted demo (no AI model): ${webUrl}\n`);
