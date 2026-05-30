// Tiny pub/sub for "the user re-pressed the tab they're already on".
//
// React Navigation already emits `tabPress` for every tap, but it does
// not differentiate between "switch to this tab" and "I'm already here
// and tapped again." We use that gesture as a toggle-style action on
// the tab's own screen (e.g. Activity: flip List ↔ Categories).
//
// Module-scoped so the screen subscribes from useEffect and the tab
// bar emits from its onPress handler — no React context plumbing.

type Listener = () => void;
const byRoute = new Map<string, Set<Listener>>();

export function emitTabReselect(route: string): void {
  const set = byRoute.get(route);
  if (!set) return;
  set.forEach((fn) => fn());
}

export function onTabReselect(route: string, fn: Listener): () => void {
  let set = byRoute.get(route);
  if (!set) {
    set = new Set();
    byRoute.set(route, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}
