import { CARD_GAP, CARD_SIZES, snapCoordinate } from "./constants";
import type { CardSize, Point } from "./types";

type BentoPlacement = {
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
};

type BentoModule = {
  columns: number;
  placements: BentoPlacement[];
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
const FULL_MODULE_CARD_COUNT = 5;
const GRID_ROWS = 2;

const FULL_MODULES: BentoModule[] = [
  {
    columns: 4,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 2 },
      { column: 2, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 3, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
      { column: 3, row: 1, columnSpan: 1, rowSpan: 1 },
    ],
  },
  {
    columns: 4,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 2, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 0, row: 1, columnSpan: 2, rowSpan: 1 },
      { column: 2, row: 1, columnSpan: 1, rowSpan: 1 },
      { column: 3, row: 1, columnSpan: 1, rowSpan: 1 },
    ],
  },
  {
    columns: 4,
    placements: [
      { column: 0, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 2, row: 0, columnSpan: 2, rowSpan: 2 },
      { column: 0, row: 1, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 1, columnSpan: 1, rowSpan: 1 },
    ],
  },
  {
    columns: 4,
    placements: [
      { column: 0, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 2, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 0, row: 1, columnSpan: 2, rowSpan: 1 },
      { column: 2, row: 1, columnSpan: 2, rowSpan: 1 },
    ],
  },
];

const PARTIAL_MODULES: Record<number, BentoModule> = {
  1: {
    columns: 2,
    placements: [{ column: 0, row: 0, columnSpan: 2, rowSpan: 2 }],
  },
  2: {
    columns: 2,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 0, row: 1, columnSpan: 2, rowSpan: 1 },
    ],
  },
  3: {
    columns: 2,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 0, row: 1, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 1, columnSpan: 1, rowSpan: 1 },
    ],
  },
  4: {
    columns: 3,
    placements: [
      { column: 0, row: 0, columnSpan: 2, rowSpan: 1 },
      { column: 2, row: 0, columnSpan: 1, rowSpan: 1 },
      { column: 0, row: 1, columnSpan: 1, rowSpan: 1 },
      { column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
    ],
  },
};

function getSpanSize(columnSpan: number, rowSpan: number): CardSize {
  return {
    width: columnSpan * BASE_TILE.width + (columnSpan - 1) * CARD_GAP,
    height: rowSpan * BASE_TILE.height + (rowSpan - 1) * CARD_GAP,
  };
}

function getModules(count: number): BentoModule[] {
  const modules: BentoModule[] = [];
  const fullModuleCount = Math.floor(count / FULL_MODULE_CARD_COUNT);
  const remainder = count % FULL_MODULE_CARD_COUNT;

  for (let index = 0; index < fullModuleCount; index += 1) {
    modules.push(FULL_MODULES[index % FULL_MODULES.length]);
  }

  if (remainder > 0) {
    modules.push(PARTIAL_MODULES[remainder]);
  }

  return modules;
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

  const modules = getModules(count);
  const columns = modules.reduce((sum, module) => sum + module.columns, 0);
  const gridSize = getSpanSize(columns, GRID_ROWS);
  const startX = snapCoordinate(center.x - gridSize.width / 2);
  const startY = snapCoordinate(center.y - gridSize.height / 2);
  const columnPitch = BASE_TILE.width + CARD_GAP;
  const rowPitch = BASE_TILE.height + CARD_GAP;
  const tiles: BentoTile[] = [];
  let columnOffset = 0;

  for (const module of modules) {
    for (const placement of module.placements) {
      tiles.push({
        pos: {
          x: startX + (columnOffset + placement.column) * columnPitch,
          y: startY + placement.row * rowPitch,
        },
        size: getSpanSize(placement.columnSpan, placement.rowSpan),
      });
    }

    columnOffset += module.columns;
  }

  return {
    columns,
    rows: GRID_ROWS,
    tiles,
  };
}
