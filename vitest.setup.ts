import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { navigationState, resetRouter, routerMock } from '@/test/router';

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => navigationState.pathname,
  useParams: () => navigationState.params,
  useSearchParams: () => new URLSearchParams(),
}));

// next/link reaches for the app router context, which no unit test mounts.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));

// jsdom ships Blob without the modern text()/arrayBuffer() readers.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// jsdom has no ResizeObserver; the sticky-offset hook only needs it to exist.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  resetRouter();
  sessionStorage.clear();
});
