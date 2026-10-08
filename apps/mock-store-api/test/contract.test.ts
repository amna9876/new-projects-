import type { AddressInfo } from 'node:net';
import { defineContractTests } from '@agentic-shop/api-contract/contract-tests';
import { serve, type ServerType } from '@hono/node-server';
import { afterAll, beforeAll, describe } from 'vitest';
import { createApp } from '../src/app';

const fixtures = { validDiscountCode: 'WELCOME10' };

describe('in-process', () => {
  const app = createApp({ publicUrl: 'http://mock.test' });
  defineContractTests({
    baseUrl: 'http://mock.test',
    fetch: async (input, init) => app.fetch(new Request(input, init)),
    fixtures,
  });
});

describe('in-process with an API key', () => {
  const app = createApp({ publicUrl: 'http://mock.test', apiKey: 'test-key' });
  defineContractTests({
    baseUrl: 'http://mock.test',
    apiKey: 'test-key',
    fetch: async (input, init) => app.fetch(new Request(input, init)),
    fixtures,
  });
});

describe('over HTTP', () => {
  const app = createApp({ publicUrl: 'http://mock.test' });
  let server: ServerType;
  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0 }, (info: AddressInfo) => {
        baseUrl = `http://127.0.0.1:${info.port}`;
        resolve();
      });
    });
  });
  afterAll(() => {
    server.close();
  });

  // The port is only known once the server is listening, so the options are resolved lazily.
  defineContractTests(() => ({ baseUrl, fixtures }));
});
