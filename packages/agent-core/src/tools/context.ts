import { StoreApiError, type StoreAdapter } from '@agentic-shop/adapters';
import type { Cart } from '@agentic-shop/api-contract';
import type { AgentSession, ResolvedAgentConfig } from '../config';

export interface ToolContext {
  store: StoreAdapter;
  /** Mutated in place when a cart is created, so the caller can persist it. */
  session: AgentSession;
  config: ResolvedAgentConfig;
}

const isNotFound = (error: unknown) => error instanceof StoreApiError && error.code === 'not_found';

/** Returns the session's cart, or undefined when there is none (or the store has dropped it). */
export async function currentCart({ store, session }: ToolContext): Promise<Cart | undefined> {
  if (!session.cartId) return undefined;
  try {
    return await store.getCart(session.cartId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    session.cartId = undefined;
    return undefined;
  }
}

/** Returns the id of the session's cart, creating the cart on first use. */
export async function ensureCartId(context: ToolContext): Promise<string> {
  const existing = await currentCart(context);
  if (existing) return existing.id;
  const created = await context.store.createCart();
  context.session.cartId = created.id;
  return created.id;
}
