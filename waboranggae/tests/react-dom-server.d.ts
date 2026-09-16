// The installed React DOM runtime is used for server-rendered UI contract tests.
declare module 'react-dom/server' {
  import type { ReactNode } from 'react';
  export function renderToStaticMarkup(node: ReactNode): string;
}
