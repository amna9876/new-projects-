export interface AgentConfig {
  /** Shown to the shopper, for example "Acme Outdoors". */
  storeName?: string;
  /** Language to answer in when the shopper's language is unclear (BCP 47, e.g. "en", "ar"). */
  defaultLanguage?: string;
  /** Maximum model steps (and so tool-call rounds) per turn. */
  maxSteps?: number;
  /** Upper bound on products returned by one search. */
  maxSearchResults?: number;
}

export const DEFAULT_AGENT_CONFIG = {
  storeName: 'the store',
  defaultLanguage: 'en',
  maxSteps: 8,
  maxSearchResults: 6,
} as const satisfies Required<AgentConfig>;

export type ResolvedAgentConfig = Required<AgentConfig>;

export function resolveAgentConfig(config: AgentConfig = {}): ResolvedAgentConfig {
  const resolved = { ...DEFAULT_AGENT_CONFIG, ...config };
  if (!Number.isInteger(resolved.maxSteps) || resolved.maxSteps < 1) {
    throw new Error('AgentConfig.maxSteps must be a positive integer.');
  }
  if (!Number.isInteger(resolved.maxSearchResults) || resolved.maxSearchResults < 1) {
    throw new Error('AgentConfig.maxSearchResults must be a positive integer.');
  }
  return resolved;
}

/**
 * Conversation-scoped state that the model can neither read nor choose.
 * The server keeps one per chat session and passes it in on every turn.
 */
export interface AgentSession {
  /** Created on the first add-to-cart; the model never supplies a cart id. */
  cartId?: string;
}
