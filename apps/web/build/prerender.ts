/**
 * Pre-renders every route to its own HTML file after the build, so search engines and link
 * previews get a real page without running the app: its own title, description, canonical
 * URL, Open Graph tags, structured data and the page text. The app replaces that text as
 * soon as it starts. Also writes sitemap.xml and a 404 page (served with status 404).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { LEGAL } from '../src/content/legal.ts';
import { landing } from '../src/content/landing.ts';
import { page, type PageId } from '../src/content/pages.ts';
import { SEO } from '../src/content/seo.ts';

export const SITE = 'https://plankway.com';

interface Route {
  path: string;
  /** Output file in dist; Cloudflare serves `/daily` from `daily.html`. */
  file: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: object[];
  noindex?: boolean;
  priority?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV: [string, string][] = [
  ['/', 'Play Plankway'],
  ['/how-to-play', 'How to play'],
  ['/leaderboard', 'Leaderboard'],
  ['/about', 'About'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
];

/** Internal links on every pre-rendered page, so crawlers find them all. */
const nav = () => `<nav><p>${NAV.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join(' · ')}</p></nav>`;

function infoBody(id: PageId): string {
  const p = page('en', id);
  const sections = p.sections
    .map(
      (s) =>
        `<h2>${esc(s.h)}</h2>` +
        s.body.map((part) => (Array.isArray(part) ? `<ul>${part.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : `<p>${esc(part)}</p>`)).join(''),
    )
    .join('');
  return `<main class="prerender"><h1>${esc(p.title)}</h1>${p.intro ? `<p>${esc(p.intro)}</p>` : ''}${sections}${nav()}</main>`;
}

function homeBody(): string {
  const c = landing('en');
  return (
    `<main class="prerender"><h1>Plankway</h1><p><strong>Connect the islands. Mind the reefs.</strong></p>` +
    `<p><a href="/daily">Play today's puzzle</a> · <a href="/endless">Endless mode</a> · <a href="/leaderboard">Leaderboard</a></p>` +
    `<h2>${esc(c.heading)}</h2><p>${esc(c.intro)}</p>` +
    `<h3>${esc(c.stepsTitle)}</h3><ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` +
    `<h3>${esc(c.featuresTitle)}</h3><ul>${c.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` +
    `<h3>${esc(c.faqTitle)}</h3>${c.faq.map(([q, a]) => `<h4>${esc(q)}</h4><p>${esc(a)}</p>`).join('')}` +
    `${nav()}</main>`
  );
}

const simpleBody = (h1: string, text: string) => `<main class="prerender"><h1>${esc(h1)}</h1><p>${esc(text)}</p>${nav()}</main>`;

function homeJsonLd(description: string): object[] {
  const c = landing('en');
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Plankway', url: `${SITE}/`, description, inLanguage: 'en' },
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: 'Plankway',
      url: `${SITE}/`,
      description,
      image: `${SITE}/og-image.jpg`,
      genre: ['Puzzle', 'Logic puzzle'],
      gamePlatform: ['Web browser', 'Android', 'iOS'],
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      playMode: 'SinglePlayer',
      inLanguage: ['en', 'nl'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      author: { '@type': 'Person', name: LEGAL.controller },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
}

function routes(): Route[] {
  const info = (id: PageId, priority: number): Route => ({
    path: `/${id}`,
    file: `${id}.html`,
    ...SEO[id],
    body: infoBody(id),
    priority,
  });
  return [
    { path: '/', file: 'index.html', ...SEO.home, body: homeBody(), jsonLd: homeJsonLd(SEO.home.description), priority: 1 },
    {
      path: '/daily',
      file: 'daily.html',
      ...SEO.daily,
      body: simpleBody('Today’s Plankway', 'One new bridges puzzle every day, the same for everyone. Connect all the islands with bridges, keep your streak going and compare your time on the leaderboard.'),
      priority: 0.9,
    },
    {
      path: '/endless',
      file: 'endless.html',
      ...SEO.endless,
      body: simpleBody('Plankway Endless', 'Level after level of bridges puzzles that grow harder as you go. Every player gets the same levels, so you can compare how far you get.'),
      priority: 0.8,
    },
    {
      path: '/leaderboard',
      file: 'leaderboard.html',
      ...SEO.leaderboard,
      body: simpleBody('Plankway leaderboard', 'The fastest times on each daily puzzle, the furthest level in endless mode and the fastest time per level: worldwide, per country and with your friends.'),
      priority: 0.7,
    },
    info('how-to-play', 0.8),
    info('about', 0.5),
    info('privacy', 0.2),
    info('cookies', 0.2),
    info('terms', 0.2),
    {
      path: '/404',
      file: '404.html',
      title: 'Page not found · Plankway',
      description: 'This page does not exist.',
      body: simpleBody('Page not found', 'This page does not exist (anymore). Head back to the islands and play today’s puzzle.'),
      noindex: true,
    },
  ];
}

function head(r: Route): string {
  const url = `${SITE}${r.path}`;
  const tags = [
    r.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Plankway" />',
    `<meta property="og:title" content="${esc(r.title)}" />`,
    `<meta property="og:description" content="${esc(r.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og-image.jpg" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="Plankway: a rope bridge between two tropical islands" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(r.jsonLd ?? []).map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`),
  ];
  return tags.map((t) => `    ${t}`).join('\n');
}

export function prerender(): Plugin {
  let outDir = '';
  return {
    name: 'plankway-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    // writeBundle finishes before any closeBundle hook, so the service worker plugin
    // (closeBundle) sees these files.
    writeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      for (const r of routes()) {
        const html = template
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`)
          .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(r.description)}" />`)
          .replace('</head>', `${head(r)}\n  </head>`)
          .replace('<div id="app"></div>', `<div id="app">${r.body}</div>`);
        if (html === template) throw new Error(`prerender: template placeholders not found for ${r.path}`);
        writeFileSync(join(outDir, r.file), html);
      }

      const today = new Date().toISOString().slice(0, 10);
      const urls = routes()
        .filter((r) => !r.noindex)
        .map((r) => `  <url><loc>${SITE}${r.path}</loc><lastmod>${today}</lastmod><priority>${(r.priority ?? 0.5).toFixed(1)}</priority></url>`);
      writeFileSync(
        join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      );
      console.log(`plankway-prerender: ${routes().length} pages and sitemap.xml`);
    },
  };
}
