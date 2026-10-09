import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney, parseHexColor, readableTextOn } from '../src/format';
import { createTranslator, directionOf } from '../src/i18n/index';
import { mount, optionsFromDataset, type MountedWidget } from '../src/mount';

const dataset = (attributes: Record<string, string>): DOMStringMap => {
  const script = document.createElement('script');
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  return script.dataset;
};

describe('optionsFromDataset', () => {
  it('reads every documented data attribute', () => {
    expect(
      optionsFromDataset(
        dataset({
          'data-api-url': ' https://chat.example.com ',
          'data-store-id': 'demo',
          'data-primary-color': '#0f766e',
          'data-position': 'bottom-left',
          'data-greeting': 'Welcome!',
          'data-language': 'ar',
        }),
      ),
    ).toEqual({
      apiUrl: 'https://chat.example.com',
      storeId: 'demo',
      primaryColor: '#0f766e',
      position: 'bottom-left',
      greeting: 'Welcome!',
      language: 'ar',
    });
  });

  it('applies defaults and falls back to the page language', () => {
    const options = optionsFromDataset(dataset({ 'data-api-url': '/chat' }), 'fr');
    expect(options).toMatchObject({ position: 'bottom-right', language: 'fr' });
    expect(options?.storeId).toBeUndefined();
    expect(optionsFromDataset(dataset({ 'data-api-url': '/chat' }), '')?.language).toBe('en');
    expect(
      optionsFromDataset(dataset({ 'data-api-url': '/chat', 'data-position': 'top' }))?.position,
    ).toBe('bottom-right');
  });

  it('returns nothing without an API URL', () => {
    expect(optionsFromDataset(dataset({ 'data-store-id': 'demo' }))).toBeUndefined();
    expect(optionsFromDataset(dataset({ 'data-api-url': '   ' }))).toBeUndefined();
  });
});

describe('mount', () => {
  let widget: MountedWidget | undefined;
  afterEach(() => {
    act(() => widget?.unmount());
    widget = undefined;
  });

  const shadowOf = async (mounted: MountedWidget) => {
    const host = () => mounted.host.querySelector<HTMLElement>('[data-agentic-shop-widget]');
    await waitFor(() => expect(host()?.shadowRoot?.querySelector('.asa-root')).toBeTruthy());
    return { host: host()!, shadow: host()!.shadowRoot! };
  };

  it('renders the widget inside a shadow root, isolated from the page', async () => {
    act(() => {
      widget = mount({ apiUrl: 'http://chat.test', storage: null });
    });
    const { shadow } = await shadowOf(widget!);

    expect(shadow.querySelector('style')?.textContent).toContain('.asa-launcher');
    expect(shadow.querySelector('button.asa-launcher')).not.toBeNull();
    // Nothing of the widget is reachable from the page's own DOM tree.
    expect(document.querySelector('.asa-launcher')).toBeNull();
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('applies the brand colour with a readable text colour', async () => {
    act(() => {
      widget = mount({ apiUrl: 'http://chat.test', storage: null, primaryColor: '#fde047' });
    });
    const { host } = await shadowOf(widget!);
    expect(host.style.getPropertyValue('--asa-primary')).toBe('#fde047');
    expect(host.style.getPropertyValue('--asa-on-primary')).toBe('#111111');
  });

  it('ignores a colour value that is not a plain hex colour', async () => {
    act(() => {
      widget = mount({
        apiUrl: 'http://chat.test',
        storage: null,
        primaryColor: 'red; background: url(https://evil.example)',
      });
    });
    const { host } = await shadowOf(widget!);
    expect(host.style.getPropertyValue('--asa-primary')).toBe('');
  });

  it('passes language and position through, and cleans up on unmount', async () => {
    act(() => {
      widget = mount({
        apiUrl: 'http://chat.test',
        storage: null,
        language: 'ar',
        position: 'bottom-left',
      });
    });
    const { shadow } = await shadowOf(widget!);
    const root = shadow.querySelector('.asa-root')!;
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.className).toContain('asa-bottom-left');

    const host = widget!.host;
    act(() => widget!.unmount());
    widget = undefined;
    expect(document.body.contains(host)).toBe(false);
  });
});

describe('formatting helpers', () => {
  it('formats money by moving the decimal point for the currency', () => {
    expect(formatMoney({ amount: 1999, currency: 'USD' }, 'en')).toBe('$19.99');
    expect(formatMoney({ amount: 500, currency: 'JPY' }, 'en')).toBe('¥500');
    expect(formatMoney({ amount: 1234567, currency: 'EUR' }, 'de')).toMatch(/12\.345,67/);
    expect(formatMoney({ amount: 100, currency: 'nope' }, 'en')).toBe('100 nope');
  });

  it('accepts only hex colours', () => {
    expect(parseHexColor(' #0F766E ')).toBe('#0F766E');
    expect(parseHexColor('#abc')).toBe('#abc');
    for (const value of ['red', 'rgb(0,0,0)', '#12', '#12345g', 'url(x)', '', undefined]) {
      expect(parseHexColor(value)).toBeUndefined();
    }
  });

  it('picks a text colour with enough contrast', () => {
    expect(readableTextOn('#000000')).toBe('#ffffff');
    expect(readableTextOn('#2563eb')).toBe('#ffffff');
    expect(readableTextOn('#ffffff')).toBe('#111111');
    expect(readableTextOn('#fde047')).toBe('#111111');
    expect(readableTextOn('#fff')).toBe('#111111');
  });
});

describe('translations', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    const t = createTranslator('en');
    expect(t('cartCount', { count: 3 })).toBe('Cart, 3 items');
    expect(t('cartCount')).toBe('Cart, {count} items');
  });

  it('resolves regional tags and falls back to English', () => {
    expect(createTranslator('ar-EG')('send')).toBe('إرسال');
    expect(createTranslator('xx')('send')).toBe('Send');
  });

  it('knows which languages are right-to-left', () => {
    expect(['ar', 'ar-SA', 'he', 'fa', 'ur'].map(directionOf)).toEqual(Array(5).fill('rtl'));
    expect(['en', 'fr', 'de-DE', 'ja'].map(directionOf)).toEqual(Array(4).fill('ltr'));
  });
});
