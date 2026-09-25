import { useEffect, useState } from 'preact/hooks';
import type { PageId } from '../content/pages.ts';

type InfoPageComponent = typeof import('./InfoPage.tsx').InfoPage;

let loaded: InfoPageComponent | null = null;

/** The long-form pages (and their texts) load on demand, keeping the start bundle small. */
export function LazyInfoPage({ id }: { id: PageId }) {
  const [Page, setPage] = useState<InfoPageComponent | null>(() => loaded);
  useEffect(() => {
    if (Page) return;
    void import('./InfoPage.tsx').then((m) => {
      loaded = m.InfoPage;
      setPage(() => m.InfoPage);
    });
  }, []);
  return Page ? <Page id={id} /> : <main class="screen info-page" aria-busy="true" />;
}
