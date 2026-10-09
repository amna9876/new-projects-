import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy* waits for streamed answers; the default of one second is too tight under load.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  // Only present in the DOM environment; the client tests run in plain Node.
  if (typeof document !== 'undefined') cleanup();
});
