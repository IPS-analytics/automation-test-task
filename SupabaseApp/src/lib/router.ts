import { useMemo, useSyncExternalStore } from 'react';

// Маршруты на hash: обновление страницы не теряет экран, а статический хостинг не нужно настраивать.
export type Route = { name: 'list' } | { name: 'new' } | { name: 'edit'; id: string };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/new') return { name: 'new' };
  const match = path.match(/^\/requests\/([\w-]+)$/);
  return match ? { name: 'edit', id: match[1] } : { name: 'list' };
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parse(hash), [hash]);
}

export function navigate(path: string) {
  window.location.hash = path;
}
