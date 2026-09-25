import {
  BENTO_MAX_CELL_AREA_PER_CARD,
  BENTO_MIN_CELL_AREA_PER_CARD,
  BENTO_TARGET_ASPECT_RATIO,
  BENTO_TARGET_CELL_AREA_PER_CARD,
  CARD_GAP,
  CARD_SIZES,
  snapCoordinate,
} from "./constants";
import type { CardSize, Point } from "./types";

type LocalPlacement = {
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
};

type MacroBlock = {
  column: number;
  row: number;
  columns: number;
  rows: number;
};

type GridCandidate = {
  columns: number;
  rows: number;
  score: number;
};

type BlockCardAllocation = {
  block: MacroBlock;
  cardCount: number;
};

type AllocationState = {
  cost: number;
  cardCounts: number[];
};

export type BentoTile = {
  pos: Point;
  size: CardSize;
};

export type BentoGridPlan = {
  columns: number;
  rows: number;
  tiles: BentoTile[];
};

const BASE_TILE = CARD_SIZES.compact;
const MAX_MACRO_BLOCK_SIZE = 3;
const MAX_TILING_VARIANTS_PER_COUNT = 6;

const ALLOWED_SPANS = [
  { columns: 1, rows: 1 },
  { columns: 2, rows: 1 },
  { columns: 1, rows: 2 },
  { columns: 3, rows: 1 },
  { columns: 1, rows: 3 },
  { columns: 2, rows: 2 },
  { columns: 3, rows: 2 },
  { columns: 2, rows: 3 },
] as const;

const BLOCK_DENSITY_WEIGHTS = [
  0.72, 1.22, 0.88, 1.14, 0.68, 1.3, 0.82, 1.18,
] as const;

const tilingCache = new Map<string, LocalPlacement[][]>();
const tilingVariantCache = new Map<string, LocalPlacement[][]>();

function getSpanSize(columnSpan: number, rowSpan: number): CardSize {
  return {
    width: columnSpan * BASE_TILE.width + (columnSpan - 1) * CARD_GAP,
    height: rowSpan * BASE_TILE.height + (rowSpan - 1) * CARD_GAP,
  };
}

function getGridPixelSize(columns: number, rows: number): CardSize {
  return getSpanSize(columns, rows);
}

function getGridCandidates(count: number): GridCandidate[] {
  if (count <= 1) {
    return [{ columns: 1, rows: 1, score: 0 }];
  }

  const maxDimension = Math.max(
    4,
    Math.ceil(Math.sqrt(count * BENTO_MAX_CELL_AREA_PER_CARD)) * 3,
  );
  const candidates: GridCandidate[] = [];

  for (let rows = 1; rows <= maxDimension; rows += 1) {
    for (let columns = 1; columns <= maxDimension; columns += 1) {
      const cellCount = columns * rows;
      const cellAreaPerCard = cellCount / count;

      if (
        cellCount < count ||
        cellAreaPerCard < BENTO_MIN_CELL_AREA_PER_CARD ||
        cellAreaPerCard > BENTO_MAX_CELL_AREA_PER_CARD
      ) {
        continue;
      }

      const size = getGridPixelSize(columns, rows);
      const aspectRatio = size.width / size.height;
      let score =
        4.5 * Math.abs(Math.log(aspectRatio / BENTO_TARGET_ASPECT_RATIO)) +
        0.8 * Math.abs(cellAreaPerCard - BENTO_TARGET_CELL_AREA_PER_CARD) +
        0.02 * (columns + rows);

      if (aspectRatio > 1.05) {
        score += (aspectRatio - 1.05) * 2.5;
      }

      candidates.push({
        columns,
        rows,
        score,
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  return candidates;
}

function chunkDimension(size: number): number[] {
  if (size <= MAX_MACRO_BLOCK_SIZE) {
    return [size];
  }

  const chunks: number[] = [];
  let remaining = size;

  while (remaining > 0) {
    if (remaining === 4) {
      chunks.push(2, 2);
      break;
    }

    if (remaining === 5) {
      chunks.push(3, 2);
      break;
    }

    chunks.push(3);
    remaining -= 3;
  }

  return chunks;
}

function createMacroBlocks(columns: number, rows: number): MacroBlock[] {
  const columnChunks = chunkDimension(columns);
  const rowChunks = chunkDimension(rows);
  const blocks: MacroBlock[] = [];
  let row = 0;

  for (const blockRows of rowChunks) {
    let column = 0;

    for (const blockColumns of columnChunks) {
      blocks.push({
        column,
        row,
        columns: blockColumns,
        rows: blockRows,
      });

      column += blockColumns;
    }

    row += blockRows;
  }

  return blocks;
}

function getMaskBit(column: number, row: number, blockColumns: number): number {
  return 1 << (row * blockColumns + column);
}

function generateTilings(columns: number, rows: number): LocalPlacement[][] {
  const cacheKey = `${columns}x${rows}`;
  const cached = tilingCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const cellCount = columns * rows;
  const fullMask = (1 << cellCount) - 1;
  const results: LocalPlacement[][] = [];

  const search = (occupiedMask: number, placements: LocalPlacement[]): void => {
    if (occupiedMask === fullMask) {
      results.push([...placements]);
      return;
    }

    let firstEmptyIndex = 0;

    while (
      firstEmptyIndex < cellCount &&
      (occupiedMask & (1 << firstEmptyIndex)) !== 0
    ) {
      firstEmptyIndex += 1;
    }

    const startColumn = firstEmptyIndex % columns;
    const startRow = Math.floor(firstEmptyIndex / columns);

    for (const span of ALLOWED_SPANS) {
      if (startColumn + span.columns > columns || startRow + span.rows > rows) {
        continue;
      }

      let placementMask = 0;
      let fits = true;

      for (let rowOffset = 0; rowOffset < span.rows && fits; rowOffset += 1) {
        for (
          let columnOffset = 0;
          columnOffset < span.columns;
          columnOffset += 1
        ) {
          const bit = getMaskBit(
            startColumn + columnOffset,
            startRow + rowOffset,
            columns,
          );

          if ((occupiedMask & bit) !== 0) {
            fits = false;
            break;
          }

          placementMask |= bit;
        }
      }

      if (!fits) {
        continue;
      }

      placements.push({
        column: startColumn,
        row: startRow,
        columnSpan: span.columns,
        rowSpan: span.rows,
      });

      search(occupiedMask | placementMask, placements);
      placements.pop();
    }
  };

  search(0, []);
  tilingCache.set(cacheKey, results);

  return results;
}

function getTilingScore(placements: readonly LocalPlacement[]): number {
  const shapeCounts = new Map<string, number>();
  let largeTileCount = 0;
  let mediumTileCount = 0;
  let verticalArea = 0;
  let horizontalArea = 0;
  let maxArea = 1;
  let extremeStripCount = 0;

  for (const placement of placements) {
    const key = `${placement.columnSpan}x${placement.rowSpan}`;
    const area = placement.columnSpan * placement.rowSpan;

    shapeCounts.set(key, (shapeCounts.get(key) ?? 0) + 1);
    maxArea = Math.max(maxArea, area);

    if (area >= 4) {
      largeTileCount += 1;
    } else if (area >= 2) {
      mediumTileCount += 1;
    }

    if (placement.rowSpan > placement.columnSpan) {
      verticalArea += area;
    } else if (placement.columnSpan > placement.rowSpan) {
      horizontalArea += area;
    }

    if (
      Math.max(placement.columnSpan, placement.rowSpan) === 3 &&
      Math.min(placement.columnSpan, placement.rowSpan) === 1
    ) {
      extremeStripCount += 1;
    }
  }

  let repetitionPenalty = 0;

  for (const count of shapeCounts.values()) {
    repetitionPenalty += Math.max(0, count - 2) * 0.2;
  }

  let score =
    shapeCounts.size * 1.5 +
    largeTileCount * 4 +
    mediumTileCount * 0.6 +
    maxArea * 0.5 +
    verticalArea * 0.12 -
    horizontalArea * 0.02 -
    repetitionPenalty;

  if (extremeStripCount === 1) {
    score += 0.5;
  } else if (extremeStripCount > 1) {
    score -= (extremeStripCount - 1) * 0.6;
  }

  return score;
}

function getTilingVariants(
  columns: number,
  rows: number,
  cardCount: number,
): LocalPlacement[][] {
  const cacheKey = `${columns}x${rows}:${cardCount}`;
  const cached = tilingVariantCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const variants = generateTilings(columns, rows)
    .filter((placements) => placements.length === cardCount)
    .sort((a, b) => getTilingScore(b) - getTilingScore(a))
    .slice(0, MAX_TILING_VARIANTS_PER_COUNT);

  tilingVariantCache.set(cacheKey, variants);

  return variants;
}

function getAvailableCardCounts(block: MacroBlock): number[] {
  const counts = new Set<number>();

  for (const tiling of generateTilings(block.columns, block.rows)) {
    counts.add(tiling.length);
  }

  return [...counts].sort((a, b) => a - b);
}

function allocateBlockCardCounts(
  blocks: readonly MacroBlock[],
  totalCardCount: number,
): BlockCardAllocation[] | null {
  const weightedAreas = blocks.map(
    (block, index) =>
      block.columns *
      block.rows *
      BLOCK_DENSITY_WEIGHTS[index % BLOCK_DENSITY_WEIGHTS.length],
  );
  const weightedAreaTotal = weightedAreas.reduce((sum, area) => sum + area, 0);
  const ideals = weightedAreas.map(
    (weightedArea) => (weightedArea / weightedAreaTotal) * totalCardCount,
  );
  let states = new Map<number, AllocationState>();

  states.set(0, {
    cost: 0,
    cardCounts: [],
  });

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const nextStates = new Map<number, AllocationState>();
    const availableCounts = getAvailableCardCounts(blocks[blockIndex]);

    for (const [assignedCount, state] of states) {
      for (const cardCount of availableCounts) {
        const nextAssignedCount = assignedCount + cardCount;

        if (nextAssignedCount > totalCardCount) {
          continue;
        }

        const nextCost = state.cost + Math.abs(cardCount - ideals[blockIndex]);
        const existing = nextStates.get(nextAssignedCount);

        if (!existing || nextCost < existing.cost) {
          nextStates.set(nextAssignedCount, {
            cost: nextCost,
            cardCounts: [...state.cardCounts, cardCount],
          });
        }
      }
    }

    states = nextStates;

    if (states.size === 0) {
      return null;
    }
  }

  const solution = states.get(totalCardCount);

  if (!solution) {
    return null;
  }

  return blocks.map((block, index) => ({
    block,
    cardCount: solution.cardCounts[index],
  }));
}

function createPlanForGrid(
  count: number,
  center: Point,
  columns: number,
  rows: number,
): BentoGridPlan | null {
  const blocks = createMacroBlocks(columns, rows);
  const allocations = allocateBlockCardCounts(blocks, count);

  if (!allocations) {
    return null;
  }

  const gridSize = getGridPixelSize(columns, rows);
  const startX = snapCoordinate(center.x - gridSize.width / 2);
  const startY = snapCoordinate(center.y - gridSize.height / 2);
  const columnPitch = BASE_TILE.width + CARD_GAP;
  const rowPitch = BASE_TILE.height + CARD_GAP;
  const tiles: BentoTile[] = [];

  for (const [blockIndex, allocation] of allocations.entries()) {
    const { block, cardCount } = allocation;
    const variants = getTilingVariants(block.columns, block.rows, cardCount);

    if (variants.length === 0) {
      return null;
    }

    const variantIndex =
      (blockIndex * 3 + columns + rows) %
      Math.min(variants.length, MAX_TILING_VARIANTS_PER_COUNT);
    const placements = variants[variantIndex];

    for (const placement of placements) {
      tiles.push({
        pos: {
          x: startX + (block.column + placement.column) * columnPitch,
          y: startY + (block.row + placement.row) * rowPitch,
        },
        size: getSpanSize(placement.columnSpan, placement.rowSpan),
      });
    }
  }

  if (tiles.length !== count) {
    return null;
  }

  return {
    columns,
    rows,
    tiles,
  };
}

export function createBentoGridPlan(
  count: number,
  center: Point,
): BentoGridPlan {
  if (count <= 0) {
    return {
      columns: 0,
      rows: 0,
      tiles: [],
    };
  }

  for (const candidate of getGridCandidates(count)) {
    const plan = createPlanForGrid(
      count,
      center,
      candidate.columns,
      candidate.rows,
    );

    if (plan) {
      return plan;
    }
  }

  const fallbackColumns = 1;
  const fallbackRows = count;
  const gridSize = getGridPixelSize(fallbackColumns, fallbackRows);
  const startX = snapCoordinate(center.x - gridSize.width / 2);
  const startY = snapCoordinate(center.y - gridSize.height / 2);
  const rowPitch = BASE_TILE.height + CARD_GAP;

  return {
    columns: fallbackColumns,
    rows: fallbackRows,
    tiles: Array.from({ length: count }, (_, index) => ({
      pos: {
        x: startX,
        y: startY + index * rowPitch,
      },
      size: BASE_TILE,
    })),
  };
}
