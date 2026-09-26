import { getLang, t } from '../i18n.ts';
import { LEGAL } from '../content/legal.ts';
import { page, type PageId } from '../content/pages.ts';
import { goBack } from '../route.ts';
import { Footer } from './Footer.tsx';

export function InfoPage({ id }: { id: PageId }) {
  const content = page(getLang(), id);

  return (
    <main class="screen info-page">
      <header class="topbar page-topbar">
        <button class="btn icon" onClick={goBack} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="topbar-title">{content.title}</h1>
      </header>
      <article class="prose">
        {content.intro && <p class="lead">{content.intro}</p>}
        {content.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.body.map((part, i) =>
              Array.isArray(part) ? (
                <ul key={i}>
                  {part.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{part}</p>
              ),
            )}
          </section>
        ))}
        {content.updated && <p class="muted">{t('page.updated', { date: LEGAL.lastUpdated })}</p>}
      </article>
      <Footer />
    </main>
  );
}
