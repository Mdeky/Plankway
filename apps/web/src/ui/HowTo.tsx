import { useEffect, useRef, useState } from 'preact/hooks';
import { t, type MessageKey } from '../i18n.ts';
import { navigate } from '../route.ts';
import { DemoBoard, demoPuzzle, type DemoStep } from './DemoBoard.tsx';
import { Dialog } from './Dialog.tsx';
import { PracticeBoard } from './PracticeBoard.tsx';

interface Slide {
  title: MessageKey;
  body: MessageKey;
  extra?: MessageKey;
  /** Animated example; absent on the practice slide, where the player plays. */
  puzzle?: ReturnType<typeof demoPuzzle>;
  steps?: DemoStep[];
}

// Island numbers in each demo follow reading order (row by row, left to right).
const SLIDES: Slide[] = [
  {
    title: 'tutorial.1.title',
    body: 'tutorial.1.body',
    puzzle: demoPuzzle('numbers', ['.....', '1.2.1', '.....']),
    steps: [{ bridges: [] }, { bridges: [[0, 1, 1]] }, { bridges: [[0, 1, 1], [1, 2, 1]], ms: 2600 }],
  },
  {
    title: 'tutorial.2.title',
    body: 'tutorial.2.body',
    extra: 'tutorial.keys',
    puzzle: demoPuzzle('drag', ['.....', '2...2', '.....']),
    steps: [{ bridges: [] }, { bridges: [[0, 1, 1]] }, { bridges: [[0, 1, 2]], ms: 1800 }, { bridges: [], ms: 1400 }],
  },
  {
    title: 'tutorial.3.title',
    body: 'tutorial.3.body',
    puzzle: demoPuzzle('cross', ['..1..', '.....', '2...2', '.....', '..1..']),
    steps: [
      { bridges: [] },
      { bridges: [[1, 2, 1]] },
      { bridges: [[1, 2, 1]], ms: 700 },
      { bridges: [[1, 2, 1]], preview: [0, 3], flash: [1, 2], ms: 1800 },
      { bridges: [[1, 2, 1]], ms: 900 },
    ],
  },
  {
    title: 'tutorial.4.title',
    body: 'tutorial.4.body',
    puzzle: demoPuzzle('reef', ['1.#.1', '.....', '2...2']),
    steps: [
      { bridges: [] },
      { bridges: [[0, 2, 1]] },
      { bridges: [[0, 2, 1], [2, 3, 1]] },
      { bridges: [[0, 2, 1], [2, 3, 1], [3, 1, 1]], ms: 2600 },
    ],
  },
  {
    title: 'tutorial.5.title',
    body: 'tutorial.5.body',
    puzzle: demoPuzzle('network', ['1.2', '...', '1.2']),
    steps: [
      { bridges: [] },
      { bridges: [[0, 2, 1]], ms: 2400 },
      { bridges: [] },
      { bridges: [[0, 1, 1]] },
      { bridges: [[0, 1, 1], [1, 3, 1]] },
      { bridges: [[0, 1, 1], [1, 3, 1], [3, 2, 1]], ms: 2600 },
    ],
  },
  { title: 'tutorial.6.title', body: 'tutorial.6.body' },
];

/** Short slide show with animated example boards. Shown on the first visit and from the menu. */
export function HowTo({ onClose }: { onClose(): void }) {
  const [index, setIndex] = useState(0);
  const swipe = useRef<number | null>(null);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;
  const go = (next: number) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      else if (ev.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog title={t('howto.title')} onClose={onClose}>
      <div
        class="tutorial"
        // Swipe between slides, but not while building bridges on the practice board.
        onPointerDown={(ev) => (swipe.current = (ev.target as Element).closest('canvas') ? null : ev.clientX)}
        onPointerUp={(ev) => {
          const dx = swipe.current === null ? 0 : ev.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {slide.puzzle && slide.steps ? <DemoBoard key={index} puzzle={slide.puzzle} steps={slide.steps} /> : <PracticeBoard />}
        <div class="tutorial-text" aria-live="polite">
          <h3>{t(slide.title)}</h3>
          <p>{t(slide.body)}</p>
          {slide.extra && <p class="muted tutorial-extra">{t(slide.extra)}</p>}
        </div>
        <div class="tutorial-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              class={i === index ? 'active' : ''}
              aria-label={t('tutorial.step', { n: i + 1, total: SLIDES.length })}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      </div>
      <div class="dialog-actions">
        {index > 0 ? (
          <button class="btn" onClick={() => go(index - 1)}>
            {t('tutorial.prev')}
          </button>
        ) : (
          <button class="btn" onClick={onClose}>
            {t('tutorial.skip')}
          </button>
        )}
        {last ? (
          <button class="btn primary" onClick={onClose}>
            {t('tutorial.play')}
          </button>
        ) : (
          <button class="btn primary" onClick={() => go(index + 1)}>
            {t('tutorial.next')}
          </button>
        )}
      </div>
      <p class="tutorial-more">
        <a
          href="/how-to-play"
          onClick={(ev) => {
            ev.preventDefault();
            onClose();
            navigate('how-to-play');
          }}
        >
          {t('howto.more')}
        </a>
      </p>
    </Dialog>
  );
}
