import { createRestAdapter, type StoreAdapter } from '@agentic-shop/adapters';
import { createMockStoreFetch, IN_PROCESS_BASE_URL } from '@agentic-shop/mock-store-api';
import { generateText, type ModelMessage } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import {
  createShoppingAgent,
  type AgentConfig,
  type AgentSession,
  type ToolResult,
} from '../src/index';

/** One scripted model step: either tool calls or a final text answer. */
export interface ScriptStep {
  calls?: { tool: string; input: unknown }[];
  text?: string;
}

type Script = ScriptStep[] | ((stepIndex: number) => ScriptStep);

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

/**
 * A model that ignores its input and replays a script. It stands in for the
 * LLM so the tests exercise the real tools, guardrails and store, and stay
 * deterministic. Once an array script runs out it answers "Done.".
 */
export function scriptedModel(script: Script): MockLanguageModelV3 {
  let stepIndex = 0;
  return new MockLanguageModelV3({
    // eslint-disable-next-line @typescript-eslint/require-await -- the SDK expects a promise
    doGenerate: async () => {
      const step =
        typeof script === 'function' ? script(stepIndex) : (script[stepIndex] ?? { text: 'Done.' });
      stepIndex += 1;

      if (step.calls?.length) {
        return {
          content: step.calls.map((call, index) => ({
            type: 'tool-call' as const,
            toolCallId: `call-${stepIndex}-${index}`,
            toolName: call.tool,
            input: JSON.stringify(call.input),
          })),
          finishReason: { unified: 'tool-calls' as const, raw: undefined },
          usage: USAGE,
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text' as const, text: step.text ?? '' }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: USAGE,
        warnings: [],
      };
    },
  });
}

export interface StoreCall {
  method: string;
  args: unknown[];
}

/** Wraps an adapter and records every call made to the store. */
export function recordingStore(store: StoreAdapter): { store: StoreAdapter; calls: StoreCall[] } {
  const calls: StoreCall[] = [];
  const proxy = new Proxy(store, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push({ method: String(property), args });
        return (value as (...inner: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { store: proxy, calls };
}

/** A fresh in-process mock store behind the real REST adapter. */
export function mockStore(): { store: StoreAdapter; calls: StoreCall[] } {
  return recordingStore(
    createRestAdapter({ baseUrl: IN_PROCESS_BASE_URL, fetch: createMockStoreFetch() }),
  );
}

export interface TurnOptions {
  script: Script;
  /** The shopper's message, or a whole conversation. */
  user: string | ModelMessage[];
  store?: StoreAdapter;
  session?: AgentSession;
  config?: AgentConfig;
}

export interface ToolRun {
  tool: string;
  input: unknown;
  output: ToolResult<unknown>;
}

/** Runs one agent turn with a scripted model and returns what happened. */
export async function runTurn(options: TurnOptions) {
  const session = options.session ?? {};
  const store = options.store ?? mockStore().store;
  const agent = createShoppingAgent({ store, session, config: options.config });
  const model = scriptedModel(options.script);

  const messages: ModelMessage[] =
    typeof options.user === 'string' ? [{ role: 'user', content: options.user }] : options.user;
  const result = await generateText({ model, messages, ...agent.settings });

  const toolRuns: ToolRun[] = result.steps.flatMap((step) =>
    step.toolResults.map((toolResult) => ({
      tool: toolResult.toolName,
      input: toolResult.input,
      output: toolResult.output as ToolResult<unknown>,
    })),
  );

  return {
    result,
    model,
    session,
    toolRuns,
    /** Everything the model was shown on its last step, as one string. */
    lastPrompt: JSON.stringify(model.doGenerateCalls.at(-1)?.prompt ?? []),
  };
}

/** Narrows a tool result to success and returns its data. */
export function dataOf<T = Record<string, unknown>>(run: ToolRun | undefined): T {
  if (!run?.output.ok) {
    throw new Error(`Expected a successful tool result, got ${JSON.stringify(run?.output)}`);
  }
  return run.output.data as T;
}

/** Narrows a tool result to failure and returns its error. */
export function errorOf(run: ToolRun | undefined) {
  if (!run || run.output.ok) {
    throw new Error(`Expected a failed tool result, got ${JSON.stringify(run?.output)}`);
  }
  return run.output.error;
}
