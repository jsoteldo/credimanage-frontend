import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// TOTAL NETWORK ISOLATION GUARD
// Prevent any test from reaching external networks or Google Cloud Run backend.
beforeAll(() => {
  const blockedFetch = (url: RequestInfo | URL) => {
    throw new Error(
      `[NETWORK ISOLATION VIOLATION] Unmocked network call blocked in test suite: ${url.toString()}. ` +
      `Ensure all API services (services/api.ts) or network calls are properly mocked.`
    );
  };

  globalThis.fetch = blockedFetch as unknown as typeof fetch;
  if (typeof window !== 'undefined') {
    window.fetch = blockedFetch as unknown as typeof fetch;
  }
});
