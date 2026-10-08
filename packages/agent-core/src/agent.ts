import type { StoreAdapter } from '@agentic-shop/adapters';
import { stepCountIs } from 'ai';
import { resolveAgentConfig, type AgentConfig, type AgentSession } from './config';
import { buildSystemPrompt } from './system-prompt';
import { createTools } from './tools/index';

export interface CreateShoppingAgentOptions {
  /** The store the agent acts on. */
  store: StoreAdapter;
  /** This conversation's state. Updated in place (for example when a cart is created). */
  session: AgentSession;
  config?: AgentConfig;
}

/** Shown when a turn ends at the step cap before the model produced an answer. */
export const STEP_LIMIT_MESSAGE =
  'That took more steps than I am allowed in one go. Could you tell me which part to continue with?';

/**
 * Assembles everything a turn needs, ready to spread into the Vercel AI SDK:
 *
 *   const agent = createShoppingAgent({ store, session });
 *   streamText({ model, messages, ...agent.settings });
 *
 * No model is chosen here: the caller supplies it, so this package stays
 * independent of any provider.
 */
export function createShoppingAgent(options: CreateShoppingAgentOptions) {
  const config = resolveAgentConfig(options.config);
  const tools = createTools({ store: options.store, session: options.session, config });

  return {
    config,
    settings: {
      system: buildSystemPrompt(config),
      tools,
      // Hard cap on model steps per turn, whatever the model wants to do.
      stopWhen: stepCountIs(config.maxSteps),
    },
  };
}

export type ShoppingAgent = ReturnType<typeof createShoppingAgent>;
