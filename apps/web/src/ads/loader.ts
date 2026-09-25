import { AD_CONFIG } from './config.ts';
import { waitForConsent, waitForTcfApi, type TcfApi } from './consent.ts';

declare global {
  interface Window {
    __tcfapi?: TcfApi;
    adsbygoogle?: unknown[];
    googlefc?: { callbackQueue?: (() => void)[]; showRevocationMessage?: () => void };
  }
}

let ready: Promise<boolean> | null = null;

function addScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Loads, only when an ad slot is actually about to be shown:
 *  1. Google's certified CMP (TCF v2.2) for the publisher,
 *  2. waits for the consent decision,
 *  3. then the AdSense script.
 * Resolves false if anything fails (blockers, no decision): the game simply shows no ads.
 */
export function adsReady(): Promise<boolean> {
  ready ??= (async () => {
    const client = AD_CONFIG.client;
    const pub = client.replace(/^ca-/, '');
    try {
      await addScript(`https://fundingchoicesmessages.google.com/i/${pub}?ers=1`);
      const api = await waitForTcfApi(() => window.__tcfapi);
      if (!api || !(await waitForConsent(api))) return false;
      await addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`, {
        crossorigin: 'anonymous',
      });
      return true;
    } catch {
      return false;
    }
  })();
  return ready;
}

/** Re-opens the consent choices (link in Settings and on the cookie page). */
export function openPrivacyChoices(): boolean {
  const fc = window.googlefc;
  if (!fc) return false;
  fc.callbackQueue ??= [];
  fc.callbackQueue.push(() => fc.showRevocationMessage?.());
  return true;
}
