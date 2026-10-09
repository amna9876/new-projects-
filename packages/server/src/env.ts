import { z } from 'zod';
import { PROVIDER_NAMES, PROVIDERS, type ProviderName } from './model';

/** Treats unset and blank variables the same, as `.env` files often leave values empty. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());

const EnvSchema = z.object({
  AI_PROVIDER: z.preprocess(blankToUndefined, z.enum(PROVIDER_NAMES).default('anthropic')),
  AI_MODEL: z.preprocess(blankToUndefined, z.string({ error: 'is required' }).trim()),
  STORE_API_BASE_URL: z.preprocess(
    blankToUndefined,
    z.url({ error: 'must be a URL' }).default('http://localhost:4000'),
  ),
  STORE_API_KEY: optionalString,
  ALLOWED_ORIGINS: z.preprocess(blankToUndefined, z.string().default('http://localhost:3000')),
  RATE_LIMIT_PER_MINUTE: z.preprocess(
    blankToUndefined,
    z.coerce.number({ error: 'must be a whole number' }).int().min(1).max(10_000).default(20),
  ),
  PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65_535).default(3001)),
  TRUST_PROXY: z.preprocess(
    blankToUndefined,
    z
      .enum(['true', 'false'], { error: 'must be "true" or "false"' })
      .default('false')
      .transform((value) => value === 'true'),
  ),
  STORE_NAME: optionalString,
});

export interface ServerEnv {
  provider: ProviderName;
  model: string;
  /** The provider API key. Never log this. */
  apiKey: string;
  storeApiBaseUrl: string;
  storeApiKey?: string;
  allowedOrigins: string[];
  rateLimitPerMinute: number;
  port: number;
  trustProxy: boolean;
  storeName?: string;
}

/** Thrown when the environment is incomplete. The message names variables, never values. */
export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\nSee .env.example for every variable.`,
    );
    this.name = 'EnvError';
  }
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = EnvSchema.safeParse(source);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`);

  // The key's variable name depends on the provider, so it is checked separately,
  // and even when other variables are wrong, so every problem is reported at once.
  const rawProvider = source.AI_PROVIDER?.trim();
  const requestedProvider =
    rawProvider === undefined || rawProvider === '' ? 'anthropic' : rawProvider;
  const providerName = PROVIDER_NAMES.find((name) => name === requestedProvider);
  const apiKeyEnv = providerName ? PROVIDERS[providerName].apiKeyEnv : undefined;
  const apiKey = apiKeyEnv ? source[apiKeyEnv]?.trim() : undefined;
  if (apiKeyEnv && !apiKey) {
    problems.push(`${apiKeyEnv} is required when AI_PROVIDER is "${providerName}"`);
  }

  if (!parsed.success || !apiKey) throw new EnvError(problems);

  const allowedOrigins = parsed.data.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (allowedOrigins.includes('*')) {
    throw new EnvError(['ALLOWED_ORIGINS must list explicit origins; "*" is not allowed']);
  }

  return {
    provider: parsed.data.AI_PROVIDER,
    model: parsed.data.AI_MODEL,
    apiKey,
    storeApiBaseUrl: parsed.data.STORE_API_BASE_URL,
    storeApiKey: parsed.data.STORE_API_KEY,
    allowedOrigins,
    rateLimitPerMinute: parsed.data.RATE_LIMIT_PER_MINUTE,
    port: parsed.data.PORT,
    trustProxy: parsed.data.TRUST_PROXY,
    storeName: parsed.data.STORE_NAME,
  };
}
