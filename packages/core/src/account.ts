/** ISO 3166-1 alpha-2 codes a player can pick as their country. */
export const COUNTRIES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

const COUNTRY_SET = new Set(COUNTRIES);

export function isCountry(code: unknown): code is string {
  return typeof code === 'string' && COUNTRY_SET.has(code);
}

export const NAME_MIN = 3;
export const NAME_MAX = 20;

/**
 * Cleans up a display name (Unicode normalisation, single spaces) and checks its shape:
 * 3–20 characters, letters and digits with spaces, dots, dashes or underscores in between.
 * Returns null when the name doesn't fit. Word filtering happens on the server.
 */
export function normalizeDisplayName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const length = [...name].length;
  if (length < NAME_MIN || length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N} ._-]*[\p{L}\p{N}])?$/u.test(name)) return null;
  // No runs of separators like "a - - b" or "x__y".
  if (/[ ._-]{2,}/.test(name)) return null;
  return name;
}
