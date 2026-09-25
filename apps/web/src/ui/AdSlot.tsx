import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n.ts';
import { AD_CONFIG, adsEnabled, type Placement } from '../ads/config.ts';
import { adsReady } from '../ads/loader.ts';

/**
 * An ad with reserved height (no layout shift). Renders nothing unless ads are configured;
 * scripts load only once the slot scrolls into view and the consent step is done.
 * Never used over or inside the board.
 */
export function AdSlot({ placement }: { placement: Placement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const enabled = adsEnabled(placement);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    let pushed = false;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (pushed || !entries.some((e) => e.isIntersecting)) return;
        pushed = true;
        observer.disconnect();
        if (!(await adsReady())) {
          setFailed(true);
          return;
        }
        try {
          (window.adsbygoogle ??= []).push({});
        } catch {
          setFailed(true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  const height = AD_CONFIG.heights[placement];
  return (
    <aside ref={ref} class={`ad-slot${failed ? ' ad-empty' : ''}`} style={{ minHeight: `${height}px` }} aria-label={t('ads.label')}>
      <span class="ad-label" aria-hidden="true">
        {t('ads.label')}
      </span>
      <ins
        class="adsbygoogle"
        style={{ display: 'block', height: `${height}px` }}
        data-ad-client={AD_CONFIG.client}
        data-ad-slot={AD_CONFIG.slots[placement]}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
