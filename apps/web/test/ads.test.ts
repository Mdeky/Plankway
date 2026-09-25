import { describe, expect, it, vi } from 'vitest';
import { adsEnabled, interstitialDue, type AdConfig } from '../src/ads/config.ts';
import { waitForConsent, waitForTcfApi, type TCData, type TcfApi } from '../src/ads/consent.ts';
import { routeFromPath } from '../src/route.ts';

const config = (over: Partial<AdConfig> = {}): AdConfig => ({
  client: 'ca-pub-1234567890123456',
  slots: { board: '111', result: '222', interstitial: '333' },
  heights: { board: 100, result: 250, interstitial: 250 },
  interstitialEvery: 5,
  ...over,
});

describe('ad configuration', () => {
  it('is off without a valid publisher id or slot', () => {
    expect(adsEnabled('board', config({ client: '' }))).toBe(false);
    expect(adsEnabled('board', config({ client: 'pub-123' }))).toBe(false);
    expect(adsEnabled('board', config({ slots: { board: '', result: '2', interstitial: '3' } }))).toBe(false);
    expect(adsEnabled('board', config())).toBe(true);
  });

  it('the default build has ads switched off', () => {
    expect(adsEnabled('board')).toBe(false);
    expect(adsEnabled('result')).toBe(false);
    expect(interstitialDue(5)).toBe(false);
  });

  it('shows the endless interstitial every N solved levels only', () => {
    const c = config();
    expect([1, 2, 3, 4, 5, 6, 10].map((n) => interstitialDue(n, c))).toEqual([false, false, false, false, true, false, true]);
    expect(interstitialDue(5, config({ interstitialEvery: 0 }))).toBe(false);
  });
});

/** Fake CMP that replays the given events to the listener. */
function fakeCmp(events: TCData[], success = true): TcfApi & { removed: number[] } {
  const removed: number[] = [];
  const api = ((command: string, _v: number, cb: (d: TCData, ok: boolean) => void, param?: unknown) => {
    if (command === 'addEventListener') for (const e of events) cb({ listenerId: 7, ...e }, success);
    if (command === 'removeEventListener') removed.push(param as number);
  }) as TcfApi & { removed: number[] };
  api.removed = removed;
  return api;
}

describe('TCF consent', () => {
  it('waits for a decision before ads may load', async () => {
    const api = fakeCmp([{ gdprApplies: true, eventStatus: 'cmpuishown' }, { gdprApplies: true, eventStatus: 'useractioncomplete' }]);
    await expect(waitForConsent(api)).resolves.toBe(true);
    expect(api.removed).toEqual([7]);
  });

  it('accepts a stored decision', async () => {
    await expect(waitForConsent(fakeCmp([{ gdprApplies: true, eventStatus: 'tcloaded' }]))).resolves.toBe(true);
  });

  it('proceeds when GDPR does not apply', async () => {
    await expect(waitForConsent(fakeCmp([{ gdprApplies: false }]))).resolves.toBe(true);
  });

  it('never loads ads while the banner is still open', async () => {
    vi.useFakeTimers();
    const pending = waitForConsent(fakeCmp([{ gdprApplies: true, eventStatus: 'cmpuishown' }]), 1000);
    vi.advanceTimersByTime(1001);
    await expect(pending).resolves.toBe(false);
    vi.useRealTimers();
  });

  it('gives up when the CMP fails or never appears', async () => {
    await expect(waitForConsent(fakeCmp([{}], false))).resolves.toBe(false);
    await expect(waitForTcfApi(() => undefined, 50, 10)).resolves.toBeNull();
  });
});

describe('routes', () => {
  it('maps paths to screens', () => {
    expect(routeFromPath('/')).toBe('home');
    expect(routeFromPath('/daily')).toBe('daily');
    expect(routeFromPath('/privacy/')).toBe('privacy');
    expect(routeFromPath('/cookies')).toBe('cookies');
    expect(routeFromPath('/nope')).toBe('home');
  });
});
