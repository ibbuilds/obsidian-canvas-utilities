import { CARD_GAP, CARD_SIZES, snapCoordinate } from "./constants";
import type { CardSize, Point } from "./types";

type BentoModule = "hero" | "small-column";

type BentoBandPlan = {
  cardCount: number;
  columns: number;
  modules: BentoModule[];
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
const TARGET_CARDS_PER_ASPECT_UNIT = 6;

function getSpanSize(columnSpan: number, rowSpan: number): CardSize {
  return {
    width: columnSpan * BASE_TILE.width + (columnSpan - 1) * CARD_GAP,
    height: rowSpan * BASE_TILE.height + (rowSpan - 1) * CARD_GAP,
  };
}

function getBandCount(cardCount: number): number {
  return Math.max(
    1,
    Math.round(Math.sqrt(cardCount / TARGET_CARDS_PER_ASPECT_UNIT)),
  );
}

function getHeroCount(cardCount: number): number {
  if (cardCount <= 2) {
    return 0;
  }

  let heroCount = Math.max(1, Math.round(cardCount / 6));

  if (heroCount % 2 !== cardCount % 2) {
    heroCount += 1;
  }

  if (heroCount > cardCount) {
    heroCount -= 2;
  }

  return Math.max(0, heroCount);
}

function getHeroSlots(moduleCount: number, heroCount: number): Set<number> {
  const slots = new Set<number>();

  for (let index = 0; index < heroCount; index += 1) {
    const slot = Math.round(
      ((index + 1) * (moduleCount + 1)) / (heroCount + 1) - 1,
    );

    slots.add(Math.max(0, Math.min(moduleCount - 1, slot)));
  }

  for (let slot = 0; slots.size < heroCount && slot < moduleCount; slot += 1) {
    slots.add(slot);
  }

  return slots;
}

function createBandPlan(cardCount: number, mirrored: boolean): BentoBandPlan {
  const heroCount = getHeroCount(cardCount);
  const smallCardCount = cardCount - heroCount;
  const smallColumnCount = smallCardCount / 2;
  const moduleCount = heroCount + smallColumnCount;
  const heroSlots = getHeroSlots(moduleCount, heroCount);
  const modules = Array.from({ length: moduleCount }, (_, index) =>
    heroSlots.has(index) ? "hero" : "small-column",
  );

  if (mirrored) {
    modules.reverse();
  }

  return {
    cardCount,
    columns: heroCount * 2 + smallColumnCount,
    modules,
  };
}

function createBandCounts(cardCount: number): number[] {
  const bandCount = Math.min(cardCount, getBandCount(cardCount));
  const baseCount = Math.floor(cardCount / bandCount);
  const remainder = cardCount % bandCount;

  return Array.from(
    { length: bandCount },
    (_, index) => baseCount + (index < remainder ? 1 : 0),
  );
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

  const bands = createBandCounts(count).map((cardCount, index) =>
    createBandPlan(cardCount, index % 2 === 1),
  );
  const columns = Math.max(...bands.map((band) => band.columns));
  const rows = bands.length * 2;
  const gridSize = getSpanSize(columns, rows);
  const startX = snapCoordinate(center.x - gridSize.width / 2);
  const startY = snapCoordinate(center.y - gridSize.height / 2);
  const columnPitch = BASE_TILE.width + CARD_GAP;
  const rowPitch = BASE_TILE.height + CARD_GAP;
  const heroSize = getSpanSize(2, 2);
  const tiles: BentoTile[] = [];
  let cardIndex = 0;

  for (const [bandIndex, band] of bands.entries()) {
    const bandColumnOffset = bandIndex % 2 === 0 ? 0 : columns - band.columns;
    let column = bandColumnOffset;
    const row = bandIndex * 2;

    for (const module of band.modules) {
      if (module === "hero") {
        tiles.push({
          pos: {
            x: startX + column * columnPitch,
            y: startY + row * rowPitch,
          },
          size: heroSize,
        });

        cardIndex += 1;
        column += 2;
        continue;
      }

      for (let localRow = 0; localRow < 2; localRow += 1) {
        if (cardIndex >= count) {
          break;
        }

        tiles.push({
          pos: {
            x: startX + column * columnPitch,
            y: startY + (row + localRow) * rowPitch,
          },
          size: BASE_TILE,
        });

        cardIndex += 1;
      }

      column += 1;
    }
  }

  return {
    columns,
    rows,
    tiles,
  };
}
