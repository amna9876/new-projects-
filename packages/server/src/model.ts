import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/** Supported values of AI_PROVIDER. */
export const PROVIDER_NAMES = ['anthropic', 'google', 'groq', 'ollama'] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface CreateModelOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderDefinition {
  /** Environment variable holding the API key. Omitted for providers that need none. */
  apiKeyEnv?: string;
  /** Environment variable that overrides the provider's endpoint, when that is supported. */
  baseUrlEnv?: string;
  defaultBaseUrl?: string;
  create(options: CreateModelOptions): LanguageModel;
}

/**
 * To add a provider: install its `@ai-sdk/*` package, add its name to
 * PROVIDER_NAMES and an entry here. Nothing else changes.
 *
 * The agent depends on reliable tool calling. Pick a model that supports
 * tools, and run `pnpm eval:live` to see how a given model behaves.
 */
export const PROVIDERS: Record<ProviderName, ProviderDefinition> = {
  anthropic: {
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    create: ({ apiKey, model }) => createAnthropic({ apiKey })(model),
  },
  google: {
    apiKeyEnv: 'GOOGLE_GENERATIVE_AI_API_KEY',
    create: ({ apiKey, model }) => createGoogleGenerativeAI({ apiKey })(model),
  },
  groq: {
    apiKeyEnv: 'GROQ_API_KEY',
    create: ({ apiKey, model }) => createGroq({ apiKey })(model),
  },
  // A model running on your own machine through Ollama's OpenAI-compatible API. No key, no cost.
  ollama: {
    baseUrlEnv: 'OLLAMA_BASE_URL',
    defaultBaseUrl: 'http://localhost:11434/v1',
    create: ({ model, baseUrl }) =>
      createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl ?? 'http://localhost:11434/v1',
      })(model),
  },
};

export function createModel(
  options: CreateModelOptions & { provider: ProviderName },
): LanguageModel {
  return PROVIDERS[options.provider].create(options);
}
