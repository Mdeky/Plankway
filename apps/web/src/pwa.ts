/**
 * Service worker registration and update flow. A new version never reloads the page on
 * its own (that could interrupt a puzzle): the app shows a "reload" prompt instead.
 */
type Listener = () => void;

let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

export function updateReady(): boolean {
  return waiting !== null;
}

export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyUpdate(): void {
  if (!waiting) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  waiting.postMessage('skip-waiting');
}

function announce(worker: ServiceWorker): void {
  waiting = worker;
  for (const l of listeners) l();
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        // Only an *update* when a previous version already controls the page.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker);
      });
    });
    // Look for a new version whenever the player comes back to the app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
  } catch {
    // No offline support in this browser; the game still works online.
  }
}
