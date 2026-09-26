import { t } from '../i18n.ts';
import { navigate, PATHS, type Route } from '../route.ts';

const LINKS: [Route, Parameters<typeof t>[0]][] = [
  ['how-to-play', 'menu.howto'],
  ['about', 'footer.about'],
  ['privacy', 'footer.privacy'],
  ['cookies', 'footer.cookies'],
  ['terms', 'footer.terms'],
];

export function Footer() {
  return (
    <footer class="site-footer">
      <nav aria-label={t('footer.label')}>
        {LINKS.map(([route, key]) => (
          <a
            key={route}
            href={PATHS[route]}
            onClick={(e) => {
              e.preventDefault();
              navigate(route);
            }}
          >
            {t(key)}
          </a>
        ))}
      </nav>
    </footer>
  );
}
