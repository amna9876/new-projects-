import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage, ChatState } from '../chat/client';
import { useWidget } from '../context';
import { ToolResult } from '../results/ToolResult';

/**
 * Renders assistant or shopper text. Only `**bold**` and line breaks are
 * interpreted. Everything else, including HTML and markdown links, stays
 * literal text, so nothing the model repeats from store data can become
 * markup or a clickable link.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          {line
            .split(/(\*\*[^*]+\*\*)/g)
            .map((segment, index): ReactNode =>
              segment.startsWith('**') && segment.endsWith('**') && segment.length > 4 ? (
                <strong key={index}>{segment.slice(2, -2)}</strong>
              ) : (
                segment
              ),
            )}
        </Fragment>
      ))}
    </>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const { t } = useWidget();
  const isUser = message.role === 'user';

  return (
    <li className={`asa-message asa-${message.role}${message.failed ? ' asa-failed' : ''}`}>
      <span className="asa-visually-hidden">{isUser ? t('you') : t('assistant')}: </span>
      {message.parts.map((part) =>
        part.kind === 'text' ? (
          part.text.trim() ? (
            <div key={part.id} className="asa-bubble">
              <RichText text={part.text} />
            </div>
          ) : null
        ) : (
          <ToolResult key={part.toolCallId} part={part} />
        ),
      )}
      {message.failed ? <span className="asa-muted">{t('notSent')}</span> : null}
    </li>
  );
}

export interface MessageListProps {
  state: ChatState;
  greeting: string;
  /** Starter prompts offered until the shopper has sent a first message. */
  suggestions: string[];
}

export function MessageList({ state, greeting, suggestions }: MessageListProps) {
  const { t, send, busy } = useWidget();
  const scroller = useRef<HTMLDivElement>(null);
  const last = state.messages.at(-1);

  // Keep the newest content in view as the answer streams in.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [state.messages, state.status]);

  return (
    <div className="asa-scroll" ref={scroller}>
      {/* The live region wraps the list: a role on the <ul> itself would strip its list semantics. */}
      <div role="log" aria-live="polite" aria-label={t('conversation')}>
        <ul className="asa-messages">
          <li className="asa-message asa-assistant">
            <div className="asa-bubble">
              <RichText text={greeting} />
            </div>
          </li>
          {state.sessionRestarted ? <li className="asa-notice">{t('sessionRestarted')}</li> : null}
          {state.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </ul>
      </div>
      {state.messages.length === 0 && suggestions.length > 0 ? (
        <div className="asa-suggestions" role="group" aria-label={t('suggestions')}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="asa-button asa-chip"
              disabled={busy}
              onClick={() => send(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {state.status === 'sending' || (state.status === 'streaming' && last?.role === 'user') ? (
        <div className="asa-typing" role="status" aria-label={t('typing')}>
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
}
