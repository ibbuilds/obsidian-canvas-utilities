import type { CardSize } from "./types";

export const SPACING_UNIT = 4;

export const CARD_SIZES = {
  compact: { width: 800, height: 500 },
  desktop: { width: 1280, height: 800 },
  largeDesktop: { width: 1440, height: 900 },
} satisfies Record<string, CardSize>;

export const SMART_CARD_SIZES = {
  small: CARD_SIZES.compact,
  medium: { width: 896, height: 560 },
  large: { width: 1120, height: 700 },
  hero: { width: 1344, height: 840 },
} satisfies Record<string, CardSize>;

export type SmartCardSizeName = keyof typeof SMART_CARD_SIZES;

export const DEFAULT_CARD_SIZE = CARD_SIZES.desktop;
export const CARD_GAP = 64;
export const BASE_PASTE_COLUMNS = 4;
export const LAYOUT_TARGET_ASPECT_RATIO = 1.6;
export const WEB_CARD_BATCH_SIZE = 100;
export const NODE_MUTATION_BATCH_SIZE = 200;
export const GROUP_PADDING = 80;

export function snapSpacing(value: number): number {
  if (!Number.isFinite(value)) {
    return CARD_GAP;
  }

  return Math.max(0, Math.round(value / SPACING_UNIT) * SPACING_UNIT);
}

export function snapCoordinate(value: number): number {
  return Math.round(value / SPACING_UNIT) * SPACING_UNIT;
}
