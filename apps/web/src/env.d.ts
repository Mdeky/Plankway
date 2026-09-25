/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AdSense publisher id, e.g. "ca-pub-1234567890123456". Empty = no ads at all. */
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_AD_SLOT_BOARD?: string;
  readonly VITE_AD_SLOT_RESULT?: string;
  readonly VITE_AD_SLOT_INTERSTITIAL?: string;
  /** Endless: show an interstitial after every N solved levels (0 = never). */
  readonly VITE_AD_INTERSTITIAL_EVERY?: string;
  /** Domain in the share text. */
  readonly VITE_SITE_URL?: string;
}
