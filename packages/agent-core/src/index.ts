export {
  createShoppingAgent,
  STEP_LIMIT_MESSAGE,
  type CreateShoppingAgentOptions,
  type ShoppingAgent,
} from './agent';
export {
  DEFAULT_AGENT_CONFIG,
  resolveAgentConfig,
  type AgentConfig,
  type AgentSession,
  type ResolvedAgentConfig,
} from './config';
export { buildSystemPrompt } from './system-prompt';
export {
  CART_MUTATION_TOOLS,
  createTools,
  type ShoppingToolName,
  type ShoppingTools,
  type ToolContext,
} from './tools/index';
export {
  buildComparison,
  COMPARE_MAX_PRODUCTS,
  COMPARE_MIN_PRODUCTS,
  type AttributeValue,
  type ComparisonRow,
  type ProductComparison,
} from './compare';
export {
  DESCRIPTION_MAX_CHARS,
  detailProduct,
  summariseProduct,
  viewCart,
  type CartView,
  type ProductDetail,
  type ProductSummary,
} from './views';
export {
  failure,
  STORE_UNAVAILABLE_MESSAGE,
  success,
  toToolFailure,
  UNEXPECTED_ERROR_MESSAGE,
  UNTRUSTED_NOTICE,
  type ToolErrorCode,
  type ToolFailure,
  type ToolResult,
  type ToolSuccess,
} from './guardrails/result';
export { isCodeFromShopper, shopperText } from './guardrails/discount';
