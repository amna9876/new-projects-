/**
 * Test support: a language model that replays a script instead of calling a
 * provider. It lets the server, the widget and the end-to-end tests run the
 * real agent, tools and store deterministically, offline and without an API key.
 */
import { simulateReadableStream, type LanguageModel } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

/** One scripted model step: tool calls, a text answer, or a failure. */
export interface ScriptStep {
  calls?: { tool: string; input: unknown }[];
  text?: string;
  error?: Error;
  /** Resolves before the step starts streaming; lets a test hold a turn open. */
  waitFor?: Promise<void>;
}

/** A fixed list of steps, or a function of the step number and the prompt the model received. */
export type Script = ScriptStep[] | ((stepIndex: number, prompt: unknown) => ScriptStep);

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

export type ScriptedModel = LanguageModel & {
  /** The options of every call made to the model, in order. */
  doStreamCalls: { prompt: unknown }[];
};

/** A streaming model that replays a script; once an array script runs out it says "Done.". */
export function scriptedModel(script: Script): ScriptedModel {
  let stepIndex = 0;
  return new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      const step =
        typeof script === 'function'
          ? script(stepIndex, prompt)
          : (script[stepIndex] ?? { text: 'Done.' });
      stepIndex += 1;
      await step.waitFor;
      if (step.error) throw step.error;

      const body = step.calls?.length
        ? step.calls.map((call, index) => ({
            type: 'tool-call' as const,
            toolCallId: `call-${stepIndex}-${index}`,
            toolName: call.tool,
            input: JSON.stringify(call.input),
          }))
        : [
            { type: 'text-start' as const, id: 'text' },
            { type: 'text-delta' as const, id: 'text', delta: step.text ?? '' },
            { type: 'text-end' as const, id: 'text' },
          ];

      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start' as const, warnings: [] },
            ...body,
            {
              type: 'finish' as const,
              finishReason: {
                unified: step.calls?.length ? ('tool-calls' as const) : ('stop' as const),
                raw: undefined,
              },
              usage: USAGE,
            },
          ],
        }),
      };
    },
  });
}
