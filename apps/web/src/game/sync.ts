import { dateForNumber, formatDate } from '@bridgle/core';
import {
  deleteRemoteProfile,
  ensureProfile,
  forgetProfile,
  recoverProfile,
  submitEndless,
  submitResult,
  type RecoverOutcome,
  type SubmitOutcome,
} from './api.ts';
import { idbClear, idbGetAll, idbPut, STORES } from './idb.ts';
import type { DailyRecord } from './stats.ts';
import { loadPendingEndless, removePendingEndless } from './storage.ts';

let running: Promise<void> | null = null;

/**
 * Sends solved daily results and endless levels that the server hasn't accepted yet.
 * Results are always stored locally first, so playing offline never breaks a streak;
 * this catches up later.
 */
export function syncResults(): Promise<void> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<void> {
  const daily = (await idbGetAll<DailyRecord>(STORES.daily)).filter((r) => r.solved && !r.synced && r.bridges);
  const endless = loadPendingEndless().sort((a, b) => a.level - b.level);
  if (!(await ensureProfile())) return;
  if (daily.length === 0 && endless.length === 0) return;

  let retried = false;
  /** Sends one result; false means stop (offline, or no profile even after retrying). */
  const send = async (submit: () => Promise<SubmitOutcome>, done: () => Promise<void> | void): Promise<boolean> => {
    let outcome = await submit();
    if (outcome === 'no-profile' && !retried) {
      // Cookie lost or profile deleted elsewhere: start a fresh profile once.
      retried = true;
      if (await ensureProfile(true)) outcome = await submit();
    }
    if (outcome === 'offline' || outcome === 'no-profile') return false;
    // 'rejected' results are marked too, so they aren't retried forever.
    await done();
    return true;
  };

  for (const r of daily) {
    const body = { timeMs: r.timeMs ?? 0, undos: r.undos, hints: r.hints, solution: r.bridges!, startToken: r.startToken };
    if (!(await send(() => submitResult(r.number, body), () => idbPut(STORES.daily, { ...r, synced: true }, r.number)))) return;
  }
  for (const r of endless) {
    const body = { timeMs: r.timeMs, hints: r.hints, solution: r.bridges, startToken: r.startToken };
    if (!(await send(() => submitEndless(r.level, body), () => removePendingEndless(r.level)))) return;
  }
}

/** Links this device to an existing profile and merges its results into local stats. */
export async function recoverWithCode(code: string): Promise<RecoverOutcome> {
  const outcome = await recoverProfile(code);
  if (!outcome.ok) return outcome;
  const local = new Map((await idbGetAll<DailyRecord>(STORES.daily)).map((r) => [r.number, r]));
  for (const res of outcome.results) {
    if (local.get(res.number)?.solved) continue;
    const record: DailyRecord = {
      number: res.number,
      date: formatDate(dateForNumber(res.number)),
      startedAt: res.solvedAt,
      solvedAt: res.solvedAt,
      solved: true,
      timeMs: res.timeMs,
      undos: res.undos,
      hints: res.hints,
      synced: true,
    };
    await idbPut(STORES.daily, record, record.number);
  }
  // Results solved on this device before linking go to the recovered profile.
  await syncResults();
  return outcome;
}

/**
 * GDPR: deletes the server profile and everything stored on this device. If the server
 * can't be reached nothing is deleted, so the player can retry (the cookie is still needed).
 */
export async function deleteAllData(): Promise<{ server: boolean }> {
  const server = await deleteRemoteProfile();
  if (!server) return { server };
  forgetProfile();
  await idbClear(STORES.daily);
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('bridgle.')) localStorage.removeItem(key);
  } catch {
    // ignore
  }
  return { server };
}
