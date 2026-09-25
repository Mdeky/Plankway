export type Placement = 'board' | 'result' | 'interstitial';

export interface AdConfig {
  client: string;
  slots: Record<Placement, string>;
  /** Reserved height per placement, so ads never shift the layout. */
  heights: Record<Placement, number>;
  interstitialEvery: number;
}

const env = import.meta.env;

export const AD_CONFIG: AdConfig = {
  client: env.VITE_ADSENSE_CLIENT?.trim() ?? '',
  slots: {
    board: env.VITE_AD_SLOT_BOARD?.trim() ?? '',
    result: env.VITE_AD_SLOT_RESULT?.trim() ?? '',
    interstitial: env.VITE_AD_SLOT_INTERSTITIAL?.trim() ?? '',
  },
  heights: { board: 100, result: 250, interstitial: 250 },
  interstitialEvery: Math.max(0, Number(env.VITE_AD_INTERSTITIAL_EVERY ?? 5) || 0),
};

/** Ads are completely off until a publisher id and the slot are configured. */
export function adsEnabled(placement: Placement, config: AdConfig = AD_CONFIG): boolean {
  return /^ca-pub-\d{10,20}$/.test(config.client) && config.slots[placement] !== '';
}

/** Endless: interstitial after every N solved levels, never during a puzzle. */
export function interstitialDue(levelSolved: number, config: AdConfig = AD_CONFIG): boolean {
  return config.interstitialEvery > 0 && levelSolved > 0 && levelSolved % config.interstitialEvery === 0 && adsEnabled('interstitial', config);
}
