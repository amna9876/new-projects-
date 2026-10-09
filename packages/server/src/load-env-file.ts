import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Loads the nearest `.env` at or above the working directory into
 * process.env, so the server finds the repository's `.env` whether it is
 * started from the root or from this package. Variables that are already set
 * win. Does nothing when there is no `.env` (for example in production, where
 * the platform provides the environment).
 */
export function loadNearestEnvFile(startDirectory: string = process.cwd()): string | undefined {
  let directory = resolve(startDirectory);
  for (;;) {
    const candidate = join(directory, '.env');
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}
