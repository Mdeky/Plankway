import { dateForNumber, formatDate } from '@bridgle/core';
import { deleteRemoteProfile, ensureProfile, forgetProfile, recoverProfile, submitResult, type RecoverOutcome } from './api.ts';
import { idbClear, idbGetAll, idbPut, STORES } from './idb.ts';
import type { DailyRecord } from './stats.ts';

let running: Promise<void> | null = null;

/**
 * Sends solved daily results that the server hasn't accepted yet. Results are always
 * stored locally first, so playing offline never breaks a streak; this catches up later.
 */
export function syncResults(): Promise<void> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<void> {
  const pending = (await idbGetAll<DailyRecord>(STORES.daily)).filter((r) => r.solved && !r.synced && r.bridges);
  if (pending.length === 0) {
    await ensureProfile();
    return;
  }
  if (!(await ensureProfile())) return;

  let retried = false;
  for (let i = 0; i < pending.length; i++) {
    const r = pending[i]!;
    const outcome = await submitResult(r.number, { timeMs: r.timeMs ?? 0, undos: r.undos, hints: r.hints, solution: r.bridges! });
    if (outcome === 'offline') return;
    if (outcome === 'no-profile') {
      // Cookie lost or profile deleted elsewhere: start a fresh profile once.
      if (retried || !(await ensureProfile(true))) return;
      retried = true;
      i--;
      continue;
    }
    // 'rejected' results are marked too, so they aren't retried forever.
    await idbPut(STORES.daily, { ...r, synced: true }, r.number);
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
