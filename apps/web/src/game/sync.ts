import { dateForNumber, formatDate } from '@bridgle/core';
import {
  deleteRemoteProfile,
  ensureProfile,
  fetchMe,
  fetchRemoteResults,
  forgetProfile,
  recoverProfile,
  signOut,
  submitEndless,
  submitResult,
  type Me,
  type RecoverOutcome,
  type RemoteResult,
  type SubmitOutcome,
} from './api.ts';
import { idbClear, idbGetAll, idbPut, STORES } from './idb.ts';
import type { DailyRecord } from './stats.ts';
import { clearEndlessGame, loadEndlessGame, loadEndlessProgress, loadPendingEndless, removePendingEndless, saveEndlessProgress } from './storage.ts';

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
  await mergeRemoteResults(outcome.results);
  // Results solved on this device before linking go to the recovered profile.
  await syncResults();
  return outcome;
}

/** Adds daily results from the server that this device doesn't have yet. */
async function mergeRemoteResults(results: RemoteResult[]): Promise<void> {
  const local = new Map((await idbGetAll<DailyRecord>(STORES.daily)).map((r) => [r.number, r]));
  for (const res of results) {
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
}

/**
 * After signing in: this device may now belong to an account with progress from other
 * devices. Pulls that in (daily results, furthest endless level), then sends what only
 * this device has.
 */
export async function afterSignIn(): Promise<Me | null> {
  const me = await fetchMe();
  if (!me) return null;
  const results = await fetchRemoteResults();
  if (results) await mergeRemoteResults(results);

  const local = loadEndlessProgress();
  if (me.endless.best > local.best) {
    const level = Math.max(local.level, me.endless.best + 1);
    saveEndlessProgress({ level, best: me.endless.best, solved: Math.max(local.solved, me.endless.solved) });
    // A level in progress below the account's level is already done elsewhere.
    const saved = loadEndlessGame();
    if (saved && saved.level < level) clearEndlessGame();
  }
  await syncResults();
  return me;
}

/** Signs this device out and clears its local game data; the account keeps everything. */
export async function signOutDevice(): Promise<boolean> {
  await syncResults();
  if (!(await signOut())) return false;
  await clearLocalData();
  return true;
}

async function clearLocalData(): Promise<void> {
  await idbClear(STORES.daily);
  try {
    for (const key of Object.keys(localStorage)) {
      // The tutorial doesn't need to show again on this device.
      if (key.startsWith('bridgle.') && key !== 'bridgle.tutorial.v1') localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * GDPR: deletes the server profile and everything stored on this device. If the server
 * can't be reached nothing is deleted, so the player can retry (the cookie is still needed).
 */
export async function deleteAllData(): Promise<{ server: boolean }> {
  const server = await deleteRemoteProfile();
  if (!server) return { server };
  forgetProfile();
  await clearLocalData();
  return { server };
}
