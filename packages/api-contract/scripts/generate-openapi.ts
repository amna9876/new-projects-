import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOpenApiYaml } from '../src/openapi';

/**
 * Writes openapi/openapi.yaml from the Zod schemas.
 * With `--check`, fails instead when the committed file is out of date.
 */
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi/openapi.yaml');
const generated = renderOpenApiYaml();

if (process.argv.includes('--check')) {
  const committed = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
  if (committed !== generated) {
    console.error(
      'openapi/openapi.yaml is out of date. Run `pnpm --filter @agentic-shop/api-contract openapi:generate` and commit the result.',
    );
    process.exit(1);
  }
  console.log('openapi/openapi.yaml is up to date.');
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generated, 'utf8');
  console.log(`Wrote ${target}`);
}
