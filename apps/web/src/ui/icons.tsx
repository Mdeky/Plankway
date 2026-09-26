/** Small line icons (24×24, drawn with the current text colour). */
const PATHS = {
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M18 14.5a7 7 0 014 6.5',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4',
  transfer: 'M4 8h13l-4-4M20 16H7l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  auto: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  login: 'M9 4H5v16h4M14 8l4 4-4 4M18 12H8',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg class={`icon ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
