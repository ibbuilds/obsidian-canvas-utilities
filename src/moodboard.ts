import {
  CARD_GAP,
  LAYOUT_TARGET_ASPECT_RATIO,
  SMART_CARD_SIZES,
} from "./constants";
import type { CardSize, Point } from "./types";

type MoodboardRow = {
  start: number;
  end: number;
  width: number;
  height: number;
};

export type MoodboardPlan = {
  centerX: number;
  startY: number;
  rows: MoodboardRow[];
};

const SIZE_PATTERN = [
  "large",
  "medium",
  "small",
  "medium",
  "small",
  "large",
  "medium",
  "small",
  "hero",
  "medium",
  "small",
  "medium",
] as const;

export function getSmartWebCardSize(
  index: number,
  count: number,
): CardSize {
  if (count <= 1) {
    return SMART_CARD_SIZES.medium;
  }

  if (count === 2) {
    return index === 0 ? SMART_CARD_SIZES.large : SMART_CARD_SIZES.medium;
  }

  if (count === 3) {
    return index === 0 ? SMART_CARD_SIZES.large : SMART_CARD_SIZES.small;
  }

  return SMART_CARD_SIZES[SIZE_PATTERN[index % SIZE_PATTERN.length]];
}

function getTargetWidth(count: number): number {
  const columns = Math.max(
    2,
    Math.ceil(Math.sqrt(count * LAYOUT_TARGET_ASPECT_RATIO)),
  );

  return (
    columns * SMART_CARD_SIZES.medium.width + (columns - 1) * CARD_GAP
  );
}

export function createMoodboardPlan(
  count: number,
  center: Point,
  getSize: (index: number) => CardSize,
): MoodboardPlan {
  if (count <= 0) {
    return {
      centerX: center.x,
      startY: center.y,
      rows: [],
    };
  }

  const targetWidth = getTargetWidth(count);
  const rows: MoodboardRow[] = [];
  let rowStart = 0;
  let rowWidth = 0;
  let rowHeight = 0;

  for (let index = 0; index < count; index += 1) {
    const size = getSize(index);
    const nextWidth = rowWidth === 0 ? size.width : rowWidth + CARD_GAP + size.width;

    if (rowWidth > 0 && nextWidth > targetWidth) {
      rows.push({
        start: rowStart,
        end: index,
        width: rowWidth,
        height: rowHeight,
      });

      rowStart = index;
      rowWidth = size.width;
      rowHeight = size.height;
      continue;
    }

    rowWidth = nextWidth;
    rowHeight = Math.max(rowHeight, size.height);
  }

  rows.push({
    start: rowStart,
    end: count,
    width: rowWidth,
    height: rowHeight,
  });

  let totalHeight = CARD_GAP * (rows.length - 1);

  for (const row of rows) {
    totalHeight += row.height;
  }

  return {
    centerX: center.x,
    startY: center.y - totalHeight / 2,
    rows,
  };
}

export function getMoodboardRowStartX(
  plan: MoodboardPlan,
  rowIndex: number,
): number {
  return plan.centerX - plan.rows[rowIndex].width / 2;
}
