import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchBoard, fetchMe, type Board, type BoardKind, type BoardScope } from '../game/api.ts';
import { todayNumber } from '../game/daily-store.ts';
import { loadEndlessProgress } from '../game/storage.ts';
import { getLang, t, type MessageKey } from '../i18n.ts';
import { goBack } from '../route.ts';
import { formatTime } from './format.ts';

type Tab = 'daily' | 'run' | 'level';

/** Times on a board get tenths: whole seconds tie too often. */
function boardTime(ms: number): string {
  return `${formatTime(ms)}.${Math.floor((ms % 1000) / 100)}`;
}

const REASON: Record<string, MessageKey> = {
  'no-name': 'board.reason.no-name',
  'not-played': 'board.reason.not-played',
  hints: 'board.reason.hints',
  unverified: 'board.reason.unverified',
};

export function LeaderboardScreen() {
  const [tab, setTab] = useState<Tab>('daily');
  const [number, setNumber] = useState(todayNumber);
  const [level, setLevel] = useState(() => Math.max(1, loadEndlessProgress().best));
  const [myCountry, setMyCountry] = useState<string | null>(null);
  const [canFriends, setCanFriends] = useState(false);
  const [scope, setScope] = useState<'world' | 'country' | 'friends'>('world');
  const [board, setBoard] = useState<Board | null | 'loading'>('loading');

  useEffect(() => {
    document.title = `${t('board.title')} · Plankway`;
    void fetchMe().then((me) => {
      setMyCountry(me?.account?.country ?? null);
      setCanFriends(!!me?.account?.displayName);
    });
    return () => {
      document.title = 'Plankway – daily bridges puzzle';
    };
  }, []);

  const country = scope === 'country' ? myCountry : null;
  useEffect(() => {
    let live = true;
    setBoard('loading');
    const kind: BoardKind = tab === 'daily' ? { kind: 'daily', number } : tab === 'level' ? { kind: 'level', level } : { kind: 'run' };
    const boardScope: BoardScope = scope === 'friends' ? { friends: true } : country ? { country } : null;
    void fetchBoard(kind, boardScope).then((b) => live && setBoard(b));
    return () => {
      live = false;
    };
  }, [tab, number, level, country, scope]);

  const countryName = useMemo(() => {
    if (!myCountry) return null;
    try {
      return new Intl.DisplayNames([getLang()], { type: 'region' }).of(myCountry) ?? myCountry;
    } catch {
      return myCountry;
    }
  }, [myCountry]);

  const value = (v: number) => (tab === 'run' ? t('board.levelValue', { level: v }) : boardTime(v));

  return (
    <main class="screen leaderboard">
      <header class="topbar page-topbar">
        <button class="btn icon" onClick={goBack} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="topbar-title">{t('board.title')}</h1>
      </header>

      <div class="segmented" role="group" aria-label={t('board.title')}>
        {(['daily', 'run', 'level'] as const).map((id) => (
          <button key={id} class={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t(`board.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <Stepper
          label={`Plankway #${number}`}
          onPrev={number > 1 ? () => setNumber(number - 1) : undefined}
          onNext={number < todayNumber() ? () => setNumber(number + 1) : undefined}
        />
      )}
      {tab === 'level' && (
        <Stepper
          label={t('game.level', { level })}
          onPrev={level > 1 ? () => setLevel(level - 1) : undefined}
          onNext={() => setLevel(level + 1)}
        />
      )}

      {(myCountry || canFriends) && (
        <div class="segmented small" role="group" aria-label={t('board.scope')}>
          <button class={scope === 'world' ? 'active' : ''} aria-pressed={scope === 'world'} onClick={() => setScope('world')}>
            {t('board.world')}
          </button>
          {myCountry && (
            <button class={scope === 'country' ? 'active' : ''} aria-pressed={scope === 'country'} onClick={() => setScope('country')}>
              {countryName}
            </button>
          )}
          {canFriends && (
            <button class={scope === 'friends' ? 'active' : ''} aria-pressed={scope === 'friends'} onClick={() => setScope('friends')}>
              {t('board.friends')}
            </button>
          )}
        </div>
      )}

      <p class="muted board-rule">{t(`board.rule.${tab}`)}</p>

      {board === 'loading' ? (
        <p class="muted board-empty">{t('board.loading')}</p>
      ) : board === null ? (
        <p class="muted board-empty">{t('board.offline')}</p>
      ) : (
        <>
          {board.entries.length === 0 ? (
            <p class="muted board-empty">{t(scope === 'friends' ? 'board.emptyFriends' : 'board.empty')}</p>
          ) : (
            <ol class="board">
              {board.entries.map((e) => (
                <li key={e.rank} class={e.you ? 'you' : ''}>
                  <span class="board-rank">{e.rank}</span>
                  <span class="board-name">
                    {e.name}
                    {e.you && <span class="sr-only"> {t('board.you')}</span>}
                  </span>
                  {e.country && (
                    <span class="board-country" title={e.country}>
                      {e.country}
                    </span>
                  )}
                  <span class="board-value">{value(e.value)}</span>
                </li>
              ))}
            </ol>
          )}
          {board.you && (
            <p class="board-you" role="status">
              {board.you.rank === null
                ? t(REASON[board.you.reason] ?? 'board.reason.not-played')
                : t('board.yourRank', { rank: board.you.rank, value: value(board.you.value) })}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Stepper({ label, onPrev, onNext }: { label: string; onPrev?: () => void; onNext?: () => void }) {
  return (
    <div class="stepper">
      <button class="btn icon" onClick={onPrev} disabled={!onPrev} aria-label={t('board.previous')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <span class="stepper-label" aria-live="polite">
        {label}
      </span>
      <button class="btn icon" onClick={onNext} disabled={!onNext} aria-label={t('board.next')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
