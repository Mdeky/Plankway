/**
 * IAB TCF v2.2 consent handling. The CMP (Google's certified "Privacy & messaging") exposes
 * window.__tcfapi. Ads are only requested once the CMP has settled: either the player made
 * a choice, a stored choice was loaded, or GDPR doesn't apply. Whether ads are then
 * personalized, non-personalized or not shown at all is decided by the CMP + AdSense from
 * the TC string — the app never overrides it.
 */
export interface TCData {
  gdprApplies?: boolean;
  eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete' | string;
  listenerId?: number;
}

export type TcfApi = (command: string, version: number, callback: (data: TCData, success: boolean) => void, param?: unknown) => void;

export function waitForConsent(api: TcfApi, timeoutMs = 30_000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean, listenerId?: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (listenerId !== undefined) api('removeEventListener', 2, () => undefined, listenerId);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    api('addEventListener', 2, (data, success) => {
      if (!success) return finish(false, data?.listenerId);
      if (data.gdprApplies === false) return finish(true, data.listenerId);
      if (data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete') finish(true, data.listenerId);
    });
  });
}

/** Polls until the CMP stub is present (it's injected by an async script). */
export function waitForTcfApi(getApi: () => TcfApi | undefined, timeoutMs = 10_000, intervalMs = 100): Promise<TcfApi | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const api = getApi();
      if (api) return resolve(api);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(check, intervalMs);
    };
    check();
  });
}
