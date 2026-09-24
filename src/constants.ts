import type { CardSize } from "./types";

export const CARD_SIZES = {
  compact: { width: 800, height: 500 },
  desktop: { width: 1280, height: 800 },
  largeDesktop: { width: 1440, height: 900 },
} satisfies Record<string, CardSize>;

export const DEFAULT_CARD_SIZE = CARD_SIZES.desktop;
export const CARD_GAP = 60;
export const MAX_COLUMNS = 4;
