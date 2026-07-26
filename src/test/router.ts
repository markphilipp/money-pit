import { vi } from 'vitest';

/**
 * App Router hooks need a router context that only exists inside a running Next app, so the
 * navigation module is stubbed globally (see vitest.setup.ts). Tests assert against these spies;
 * real navigation is covered by the Playwright specs.
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = '/';
let params: Record<string, string> = {};

export const navigationState = {
  get pathname() {
    return pathname;
  },
  get params() {
    return params;
  },
};

export function setRoute(next: string, nextParams: Record<string, string> = {}) {
  pathname = next;
  params = nextParams;
}

export function resetRouter() {
  setRoute('/');
  for (const fn of Object.values(routerMock)) fn.mockClear();
}
