import { landing } from '../content/landing.ts';
import { getLang } from '../i18n.ts';

/** "About Plankway" below the menu: what the game is, how to play, and a short FAQ. */
export function HomeAbout() {
  const c = landing(getLang());
  return (
    <section class="home-about" aria-labelledby="home-about-title">
      <h2 id="home-about-title">{c.heading}</h2>
      <p>{c.intro}</p>
      <h3>{c.stepsTitle}</h3>
      <ol>
        {c.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h3>{c.featuresTitle}</h3>
      <ul>
        {c.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <h3>{c.faqTitle}</h3>
      {c.faq.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </section>
  );
}
