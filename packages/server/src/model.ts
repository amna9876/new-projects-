import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

/** Supported values of AI_PROVIDER. */
export const PROVIDER_NAMES = ['anthropic'] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export interface ProviderDefinition {
  /** Name of the environment variable that holds this provider's API key. */
  apiKeyEnv: string;
  create(options: { apiKey: string; model: string }): LanguageModel;
}

/**
 * To add a provider: install its `@ai-sdk/*` package, add its name to
 * PROVIDER_NAMES and an entry here. Nothing else changes.
 */
export const PROVIDERS: Record<ProviderName, ProviderDefinition> = {
  anthropic: {
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    create: ({ apiKey, model }) => createAnthropic({ apiKey })(model),
  },
};

export function createModel(options: {
  provider: ProviderName;
  model: string;
  apiKey: string;
}): LanguageModel {
  return PROVIDERS[options.provider].create(options);
}
