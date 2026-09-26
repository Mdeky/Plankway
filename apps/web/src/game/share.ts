import { t } from '../i18n.ts';
import { formatTime } from '../ui/format.ts';

export const SITE_URL: string = import.meta.env?.VITE_SITE_URL ?? 'plankway.com';

export interface ShareInput {
  number: number;
  timeMs: number;
  hints: number;
}

const ISLAND = '🏝️';
const WAVE = '🌊';

/** Five islands for a clean solve; hints wash some away. Never reveals the grid. */
export function islandRow(hints: number): string {
  const lost = Math.min(4, hints * 2);
  return ISLAND.repeat(5 - lost) + WAVE.repeat(lost);
}

export function shareText({ number, timeMs, hints }: ShareInput, url = SITE_URL): string {
  let line2 = islandRow(hints);
  if (hints > 0) line2 += ` 💡 ${t(hints === 1 ? 'share.hint' : 'share.hints', { n: hints })}`;
  return [`Plankway #${number} 🌉 ${formatTime(timeMs)}`, line2, url].join('\n');
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Native share sheet on phones, clipboard elsewhere. */
export async function shareResult(text: string): Promise<ShareOutcome> {
  const mobile = typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
  if (mobile) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
