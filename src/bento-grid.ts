import {
  CARD_GAP,
  CARD_SIZES,
  snapCoordinate,
} from "./constants";
import type { CardSize, Point } from "./types";

type BentoTemplatePlacement = {
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
};

type BentoBlockTemplate = {
  columns: number;
  rows: number;
  placements: BentoTemplatePlacement[];
};

export type BentoTile = {
  pos: Point;
  size: CardSize;
};

export type BentoGridPlan = {
  tiles: BentoTile[];
};

const BASE_TILE = CARD_SIZES.compact;
const CARDS_PER_FULL_BLOCK = 5;

const FULL_BLOCK: BentoBlockTemplate = {
  columns: 5,
  rows: 2,
  placements: [
    { column: 0, row: 0, columnSpan: 2, rowSpan: 2 },
    { column: 2, row: 0, columnSpan: 2, rowSpan: 1 },
    { column: 4, row: 0, columnSpan: 1, rowSpan: 1 },
    { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
    { column: 3, row: 1, columnSpan: 2, rowSpan: 1 },
  ],
};

const PARTIAL_BLOCKS: Record<number, BentoBlockTemplate> = {
  1: {
    columns: 1,
    rows: 1,
    placements: [{ column: 0, row: 0, columnSpan: 1, rowSpan: 1 }],
  },
  2: {
    columns: 2,
    rows: 1,
    placements: [
      { column: 0, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 0, columnSpan: 1, rowSpan: 1 },
    ],
  },
  3: {
    columns: 3,
    rows: 2,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 2 },
      { column: 2, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
    ],
  },
  4: {
    columns: 4,
    rows: 2,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 2 },
      { column: 2, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 3, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 2, row: 1, columnSpan: 2, rowSpan: 1 },
    ],
  },
};

function mirrorTemplate(template: BentoBlockTemplate): BentoBlockTemplate {
  return {
    ...template,
    placements: template.placements.map((placement) => ({
      ...placement,
      column:
        template.columns - placement.column - placement.columnSpan,
    })),
  };
}

function getBlockTemplate(
  count: number,
  mirrored: boolean,
): BentoBlockTemplate {
  const template =
    count === CARDS_PER_FULL_BLOCK ? FULL_BLOCK : PARTIAL_BLOCKS[count];

  return mirrored ? mirrorTemplate(template) : template;
}

function getSpanSize(
  columnSpan: number,
  rowSpan: number,
): CardSize {
  return {
    width:
      columnSpan * BASE_TILE.width + (columnSpan - 1) * CARD_GAP,
    height:
      rowSpan * BASE_TILE.height + (rowSpan - 1) * CARD_GAP,
  };
}

function getBlockPixelSize(template: BentoBlockTemplate): CardSize {
  return getSpanSize(template.columns, template.rows);
}

export function createBentoGridPlan(
  count: number,
  center: Point,
): BentoGridPlan {
  if (count <= 0) {
    return { tiles: [] };
  }

  const blockTemplates: BentoBlockTemplate[] = [];

  for (
    let start = 0, blockIndex = 0;
    start < count;
    start += CARDS_PER_FULL_BLOCK, blockIndex += 1
  ) {
    const blockCount = Math.min(CARDS_PER_FULL_BLOCK, count - start);
    blockTemplates.push(
      getBlockTemplate(blockCount, blockIndex % 2 === 1),
    );
  }

  let totalHeight = CARD_GAP * (blockTemplates.length - 1);

  for (const template of blockTemplates) {
    totalHeight += getBlockPixelSize(template).height;
  }

  const tiles: BentoTile[] = [];
  let blockY = snapCoordinate(center.y - totalHeight / 2);

  for (const template of blockTemplates) {
    const blockSize = getBlockPixelSize(template);
    const blockX = snapCoordinate(center.x - blockSize.width / 2);

    for (const placement of template.placements) {
      const size = getSpanSize(
        placement.columnSpan,
        placement.rowSpan,
      );

      tiles.push({
        pos: {
          x:
            blockX +
            placement.column * (BASE_TILE.width + CARD_GAP),
          y:
            blockY +
            placement.row * (BASE_TILE.height + CARD_GAP),
        },
        size,
      });
    }

    blockY += blockSize.height + CARD_GAP;
  }

  return { tiles };
}
