import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../src/chat/client';
import { Widget } from '../src/components/Widget';
import { CART, fakeController, SKILLET } from './helpers';

const text = (id: string, role: ChatMessage['role'], value: string): ChatMessage => ({
  id,
  role,
  parts: [{ kind: 'text', id: 'text', text: value }],
});

const launcher = () => screen.getByRole('button', { name: /shopping assistant$/ });
const input = () => screen.getByRole('textbox', { name: 'Message' });

describe('opening and closing', () => {
  it('starts closed with an accessible launcher', () => {
    const { controller } = fakeController();
    render(<Widget client={controller} />);

    const button = screen.getByRole('button', { name: 'Open shopping assistant' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a labelled dialog, greets, and moves focus to the input', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open shopping assistant' }));

    const dialog = screen.getByRole('dialog', { name: 'Shopping assistant' });
    expect(within(dialog).getByText(/I can help you find products/)).toBeDefined();
    expect(document.activeElement).toBe(input());
    expect(launcher().getAttribute('aria-expanded')).toBe('true');
    expect(launcher().getAttribute('aria-controls')).toBe(dialog.id);
  });

  it('closes on Escape and returns focus to the launcher', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);

    await userEvent.type(input(), '{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Open shopping assistant' }),
    );
  });

  it('closes from the header button', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses a custom greeting', () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen greeting="Welcome to Acme!" />);
    expect(screen.getByText('Welcome to Acme!')).toBeDefined();
  });
});

describe('composer', () => {
  it('sends on Enter, clears the field, and keeps Shift+Enter for new lines', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);

    await userEvent.type(input(), 'line one{Shift>}{Enter}{/Shift}line two');
    expect(controller.send).not.toHaveBeenCalled();
    await userEvent.type(input(), '{Enter}');

    expect(controller.send).toHaveBeenCalledExactlyOnceWith('line one\nline two');
    expect((input() as HTMLTextAreaElement).value).toBe('');
  });

  it('sends from the button and ignores blank input', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);
    const send = screen.getByRole<HTMLButtonElement>('button', { name: 'Send' });

    expect(send.disabled).toBe(true);
    await userEvent.type(input(), '   ');
    expect(send.disabled).toBe(true);

    await userEvent.type(input(), 'tents');
    await userEvent.click(send);
    expect(controller.send).toHaveBeenCalledExactlyOnceWith('tents');
  });

  it('cannot send while an answer is in progress', async () => {
    const { controller } = fakeController({ status: 'streaming' });
    render(<Widget client={controller} defaultOpen />);
    await userEvent.type(input(), 'hello{Enter}');
    expect(controller.send).not.toHaveBeenCalled();
    expect((input() as HTMLTextAreaElement).value).toBe('hello');
  });

  it('limits the message length', () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);
    expect(input().getAttribute('maxlength')).toBe('2000');
  });
});

describe('conversation', () => {
  it('renders messages in a polite live region', () => {
    const { controller } = fakeController({
      messages: [text('1', 'user', 'find a skillet'), text('2', 'assistant', 'Here you go.')],
    });
    render(<Widget client={controller} defaultOpen />);

    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(within(log).getByText('find a skillet')).toBeDefined();
    expect(within(log).getByText('Here you go.')).toBeDefined();
  });

  it('shows the typing indicator only while waiting for the first token', () => {
    const { controller, setState } = fakeController({ status: 'sending' });
    render(<Widget client={controller} defaultOpen />);
    expect(screen.getByRole('status', { name: 'The assistant is typing' })).toBeDefined();

    setState({ status: 'streaming', messages: [text('1', 'assistant', 'Hel')] });
    return screen.findByText('Hel').then(() => {
      expect(screen.queryByRole('status', { name: 'The assistant is typing' })).toBeNull();
    });
  });

  it('renders bold and line breaks but keeps links and HTML as plain text', () => {
    const reply =
      'The **Ember skillet** is $45.00.\nSee [the deal](https://evil.example) <a href="https://evil.example">here</a>';
    const { controller } = fakeController({ messages: [text('1', 'assistant', reply)] });
    render(<Widget client={controller} defaultOpen />);

    const log = screen.getByRole('log');
    expect(within(log).getByText('Ember skillet').tagName).toBe('STRONG');
    expect(log.querySelector('br')).not.toBeNull();
    expect(log.querySelectorAll('a')).toHaveLength(0);
    expect(log.textContent).toContain('[the deal](https://evil.example)');
    expect(log.textContent).toContain('<a href="https://evil.example">here</a>');
  });

  it('renders product cards from tool results and disables their buttons while busy', async () => {
    const message: ChatMessage = {
      id: '1',
      role: 'assistant',
      parts: [
        {
          kind: 'tool',
          toolCallId: 'c1',
          toolName: 'searchProducts',
          state: 'done',
          output: { ok: true, data: { products: [SKILLET] } },
        },
        { kind: 'text', id: 't', text: 'One match.' },
      ],
    };
    const { controller, setState } = fakeController({ messages: [message] });
    render(<Widget client={controller} defaultOpen />);

    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(controller.send).toHaveBeenCalledExactlyOnceWith(
      'Add "Ember 10" Cast Iron Skillet" to my cart.',
    );

    setState({ status: 'sending' });
    const button = await screen.findByRole('button', { name: 'Add to cart' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks a message that was not sent and offers a retry', async () => {
    const { controller } = fakeController({
      messages: [{ ...text('1', 'user', 'hello'), failed: true }],
      error: { kind: 'offline' },
    });
    render(<Widget client={controller} defaultOpen />);

    expect(screen.getByText('Not sent')).toBeDefined();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not reach the assistant');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(controller.retry).toHaveBeenCalledOnce();
  });

  it.each([
    [{ kind: 'rate_limited', retryAfterSeconds: 12 } as const, 'Try again in 12 seconds'],
    [{ kind: 'busy' } as const, 'wait for the current answer'],
    [{ kind: 'generic' } as const, 'Something went wrong'],
  ])('explains the %o error', (error, expected) => {
    const { controller } = fakeController({ error });
    render(<Widget client={controller} defaultOpen />);
    expect(screen.getByRole('alert').textContent).toContain(expected);
  });

  it('says when an expired session was replaced', () => {
    const { controller } = fakeController({ sessionRestarted: true });
    render(<Widget client={controller} defaultOpen />);
    expect(screen.getByText(/earlier conversation expired/)).toBeDefined();
  });
});

describe('starter suggestions', () => {
  it('offers suggestions before the first message and sends the chosen one', async () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen />);

    const group = screen.getByRole('group', { name: 'Suggestions' });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    await userEvent.click(within(group).getByRole('button', { name: 'Show my cart' }));
    expect(controller.send).toHaveBeenCalledExactlyOnceWith('Show my cart');
  });

  it('hides them once the conversation has started, and when given none', () => {
    const started = fakeController({ messages: [text('1', 'user', 'hi')] });
    const { unmount } = render(<Widget client={started.controller} defaultOpen />);
    expect(screen.queryByRole('group', { name: 'Suggestions' })).toBeNull();
    unmount();

    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen suggestions={[]} />);
    expect(screen.queryByRole('group', { name: 'Suggestions' })).toBeNull();
  });

  it('accepts custom suggestions', () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen suggestions={['Winter jackets']} />);
    expect(screen.getByRole('button', { name: 'Winter jackets' })).toBeDefined();
  });
});

describe('cart', () => {
  it('shows the item count on the cart button and the cart in a drawer', async () => {
    const { controller, setState } = fakeController();
    render(<Widget client={controller} defaultOpen />);

    const cartButton = screen.getByRole('button', { name: 'Cart, 0 items' });
    await userEvent.click(cartButton);
    expect(
      within(screen.getByRole('region', { name: 'Cart' })).getByText('Your cart is empty.'),
    ).toBeDefined();

    setState({ cart: CART });
    const updated = await screen.findByRole('button', { name: 'Cart, 2 items' });
    expect(updated.getAttribute('aria-expanded')).toBe('true');
    const drawer = screen.getByRole('region', { name: 'Cart' });
    expect(within(drawer).getByText('$358.20')).toBeDefined();
  });
});

describe('language and direction', () => {
  it('is left-to-right in English at the chosen corner', () => {
    const { controller } = fakeController();
    const { container } = render(<Widget client={controller} position="bottom-left" />);
    const root = container.querySelector('.asa-root')!;
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.getAttribute('lang')).toBe('en');
    expect(root.className).toContain('asa-bottom-left');
  });

  it('switches strings and direction for Arabic', () => {
    const { controller } = fakeController({ cart: CART });
    const { container } = render(<Widget client={controller} language="ar" defaultOpen />);
    const root = container.querySelector('.asa-root')!;

    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.getAttribute('lang')).toBe('ar');
    expect(screen.getByRole('dialog', { name: 'مساعد التسوق' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'إرسال' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'الرسالة' })).toBeDefined();
  });

  it('is right-to-left for languages without bundled strings, falling back to English text', () => {
    const { controller } = fakeController();
    const { container } = render(<Widget client={controller} language="ur-PK" defaultOpen />);
    expect(container.querySelector('.asa-root')!.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('accepts string overrides', () => {
    const { controller } = fakeController();
    render(<Widget client={controller} defaultOpen strings={{ title: 'Acme Helper' }} />);
    expect(screen.getByRole('dialog', { name: 'Acme Helper' })).toBeDefined();
  });
});
