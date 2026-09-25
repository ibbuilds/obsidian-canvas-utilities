import {
  getSelectionBounds,
  getSelectionCenter,
  sortNodesReadingOrder,
  updateNodeGeometry,
} from "./canvas-helpers";
import {
  CARD_GAP,
  LAYOUT_TARGET_ASPECT_RATIO,
  NODE_MUTATION_BATCH_SIZE,
  SMART_CARD_SIZES,
  type SmartCardSizeName,
} from "./constants";
import {
  createMoodboardPlan,
  getMoodboardRowStartX,
  getSmartWebCardSize,
} from "./moodboard";
import { forEachBatched } from "./scheduler";
import type { CanvasNodeLike } from "./types";

export type SizeMatchMode = "largest" | "smallest";
export type SelectionLayout = "row" | "column" | "grid" | "bento" | "moodboard";
export type GapDirection = "horizontal" | "vertical";
export type Alignment =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";
export type DistributionDirection = "horizontal" | "vertical";

function getBalancedColumnCount(nodes: readonly CanvasNodeLike[]): number {
  if (nodes.length <= 1) {
    return Math.max(nodes.length, 1);
  }

  let totalWidth = 0;
  let totalHeight = 0;

  for (const node of nodes) {
    totalWidth += node.width;
    totalHeight += node.height;
  }

  const averageWidth = Math.max(totalWidth / nodes.length, 1);
  const averageHeight = Math.max(totalHeight / nodes.length, 1);
  const rawColumns = Math.sqrt(
    nodes.length * LAYOUT_TARGET_ASPECT_RATIO * (averageHeight / averageWidth),
  );

  return Math.min(nodes.length, Math.max(1, Math.ceil(rawColumns)));
}

function isWebCard(node: CanvasNodeLike): boolean {
  const data = node.getData();

  return data.type === "link" || typeof data.url === "string";
}

export async function matchNodeSizes(
  nodes: CanvasNodeLike[],
  mode: SizeMatchMode,
): Promise<void> {
  if (nodes.length === 0) {
    return;
  }

  let target = nodes[0];
  let targetArea = target.width * target.height;

  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index];
    const area = node.width * node.height;
    const shouldReplace =
      mode === "largest" ? area > targetArea : area < targetArea;

    if (shouldReplace) {
      target = node;
      targetArea = area;
    }
  }

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;

    updateNodeGeometry(node, {
      x: centerX - target.width / 2,
      y: centerY - target.height / 2,
      width: target.width,
      height: target.height,
    });
  });
}

export async function setNodeSizePreset(
  nodes: CanvasNodeLike[],
  preset: SmartCardSizeName,
): Promise<void> {
  const size = SMART_CARD_SIZES[preset];

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;

    updateNodeGeometry(node, {
      x: centerX - size.width / 2,
      y: centerY - size.height / 2,
      width: size.width,
      height: size.height,
    });
  });
}

export async function alignNodes(
  nodes: CanvasNodeLike[],
  alignment: Alignment,
): Promise<void> {
  const bounds = getSelectionBounds(nodes);

  if (!bounds) {
    return;
  }

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    if (alignment === "left") {
      updateNodeGeometry(node, { x: bounds.minX });
      return;
    }

    if (alignment === "center-x") {
      updateNodeGeometry(node, { x: centerX - node.width / 2 });
      return;
    }

    if (alignment === "right") {
      updateNodeGeometry(node, { x: bounds.maxX - node.width });
      return;
    }

    if (alignment === "top") {
      updateNodeGeometry(node, { y: bounds.minY });
      return;
    }

    if (alignment === "center-y") {
      updateNodeGeometry(node, { y: centerY - node.height / 2 });
      return;
    }

    updateNodeGeometry(node, { y: bounds.maxY - node.height });
  });
}

export async function distributeNodes(
  nodes: CanvasNodeLike[],
  direction: DistributionDirection,
): Promise<void> {
  if (nodes.length < 3) {
    return;
  }

  if (direction === "horizontal") {
    nodes.sort((a, b) => a.x - b.x);

    const start = nodes[0].x;
    const end = nodes[nodes.length - 1].x + nodes[nodes.length - 1].width;
    let occupiedWidth = 0;

    for (const node of nodes) {
      occupiedWidth += node.width;
    }

    const gap = (end - start - occupiedWidth) / (nodes.length - 1);
    let x = start;

    await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
      updateNodeGeometry(node, { x });
      x += node.width + gap;
    });

    return;
  }

  nodes.sort((a, b) => a.y - b.y);

  const start = nodes[0].y;
  const end = nodes[nodes.length - 1].y + nodes[nodes.length - 1].height;
  let occupiedHeight = 0;

  for (const node of nodes) {
    occupiedHeight += node.height;
  }

  const gap = (end - start - occupiedHeight) / (nodes.length - 1);
  let y = start;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    updateNodeGeometry(node, { y });
    y += node.height + gap;
  });
}

async function arrangeRow(
  nodes: CanvasNodeLike[],
  centerY: number,
): Promise<void> {
  nodes.sort((a, b) => a.x - b.x);

  let totalWidth = CARD_GAP * (nodes.length - 1);

  for (const node of nodes) {
    totalWidth += node.width;
  }

  let x = getSelectionCenter(nodes).x - totalWidth / 2;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    updateNodeGeometry(node, {
      x,
      y: centerY - node.height / 2,
    });
    x += node.width + CARD_GAP;
  });
}

async function arrangeColumn(
  nodes: CanvasNodeLike[],
  centerX: number,
): Promise<void> {
  nodes.sort((a, b) => a.y - b.y);

  let totalHeight = CARD_GAP * (nodes.length - 1);

  for (const node of nodes) {
    totalHeight += node.height;
  }

  let y = getSelectionCenter(nodes).y - totalHeight / 2;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    updateNodeGeometry(node, {
      x: centerX - node.width / 2,
      y,
    });
    y += node.height + CARD_GAP;
  });
}

async function arrangeGrid(nodes: CanvasNodeLike[]): Promise<void> {
  sortNodesReadingOrder(nodes);

  const center = getSelectionCenter(nodes);
  const columns = getBalancedColumnCount(nodes);
  const rows = Math.ceil(nodes.length / columns);
  const columnWidths = new Array<number>(columns).fill(0);
  const rowHeights = new Array<number>(rows).fill(0);

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], node.width);
    rowHeights[row] = Math.max(rowHeights[row], node.height);
  }

  let gridWidth = CARD_GAP * (columns - 1);
  let gridHeight = CARD_GAP * (rows - 1);

  for (const width of columnWidths) {
    gridWidth += width;
  }

  for (const height of rowHeights) {
    gridHeight += height;
  }

  const columnOffsets = new Array<number>(columns);
  const rowOffsets = new Array<number>(rows);
  let offset = center.x - gridWidth / 2;

  for (let column = 0; column < columns; column += 1) {
    columnOffsets[column] = offset;
    offset += columnWidths[column] + CARD_GAP;
  }

  offset = center.y - gridHeight / 2;

  for (let row = 0; row < rows; row += 1) {
    rowOffsets[row] = offset;
    offset += rowHeights[row] + CARD_GAP;
  }

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    updateNodeGeometry(node, {
      x: columnOffsets[column] + (columnWidths[column] - node.width) / 2,
      y: rowOffsets[row] + (rowHeights[row] - node.height) / 2,
    });
  });
}

async function arrangeBento(nodes: CanvasNodeLike[]): Promise<void> {
  sortNodesReadingOrder(nodes);

  const center = getSelectionCenter(nodes);
  const columns = getBalancedColumnCount(nodes);
  const rows = Math.ceil(nodes.length / columns);
  const rowWidths = new Array<number>(rows).fill(0);
  const rowHeights = new Array<number>(rows).fill(0);

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const row = Math.floor(index / columns);
    const column = index % columns;

    rowWidths[row] += node.width;

    if (column > 0) {
      rowWidths[row] += CARD_GAP;
    }

    rowHeights[row] = Math.max(rowHeights[row], node.height);
  }

  let totalHeight = CARD_GAP * (rows - 1);

  for (const height of rowHeights) {
    totalHeight += height;
  }

  const rowOffsetsY = new Array<number>(rows);
  const rowCursorsX = new Array<number>(rows);
  let y = center.y - totalHeight / 2;

  for (let row = 0; row < rows; row += 1) {
    rowOffsetsY[row] = y;
    rowCursorsX[row] = center.x - rowWidths[row] / 2;
    y += rowHeights[row] + CARD_GAP;
  }

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node, index) => {
    const row = Math.floor(index / columns);
    const x = rowCursorsX[row];

    updateNodeGeometry(node, {
      x,
      y: rowOffsetsY[row] + (rowHeights[row] - node.height) / 2,
    });

    rowCursorsX[row] += node.width + CARD_GAP;
  });
}

async function arrangeMoodboard(nodes: CanvasNodeLike[]): Promise<void> {
  sortNodesReadingOrder(nodes);

  const center = getSelectionCenter(nodes);
  const resizeWebCards = nodes.every(isWebCard);
  const getSize = (index: number) =>
    resizeWebCards
      ? getSmartWebCardSize(index, nodes.length)
      : { width: nodes[index].width, height: nodes[index].height };
  const plan = createMoodboardPlan(nodes.length, center, getSize);

  let rowIndex = 0;
  let x = getMoodboardRowStartX(plan, rowIndex);
  let y = plan.startY;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node, index) => {
    while (index >= plan.rows[rowIndex].end) {
      y += plan.rows[rowIndex].height + CARD_GAP;
      rowIndex += 1;
      x = getMoodboardRowStartX(plan, rowIndex);
    }

    const size = getSize(index);

    updateNodeGeometry(node, {
      x,
      y: y + (plan.rows[rowIndex].height - size.height) / 2,
      width: size.width,
      height: size.height,
    });

    x += size.width + CARD_GAP;
  });
}

export async function arrangeNodes(
  nodes: CanvasNodeLike[],
  layout: SelectionLayout,
): Promise<void> {
  if (nodes.length === 0) {
    return;
  }

  const center = getSelectionCenter(nodes);

  if (layout === "row") {
    await arrangeRow(nodes, center.y);
    return;
  }

  if (layout === "column") {
    await arrangeColumn(nodes, center.x);
    return;
  }

  if (layout === "bento") {
    await arrangeBento(nodes);
    return;
  }

  if (layout === "moodboard") {
    await arrangeMoodboard(nodes);
    return;
  }

  await arrangeGrid(nodes);
}

export async function setNodeGap(
  nodes: CanvasNodeLike[],
  direction: GapDirection,
  gap: number,
): Promise<void> {
  if (nodes.length === 0) {
    return;
  }

  const center = getSelectionCenter(nodes);

  if (direction === "horizontal") {
    nodes.sort((a, b) => a.x - b.x);

    let totalWidth = gap * (nodes.length - 1);

    for (const node of nodes) {
      totalWidth += node.width;
    }

    let x = center.x - totalWidth / 2;

    await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
      updateNodeGeometry(node, { x });
      x += node.width + gap;
    });

    return;
  }

  nodes.sort((a, b) => a.y - b.y);

  let totalHeight = gap * (nodes.length - 1);

  for (const node of nodes) {
    totalHeight += node.height;
  }

  let y = center.y - totalHeight / 2;

  await forEachBatched(nodes, NODE_MUTATION_BATCH_SIZE, (node) => {
    updateNodeGeometry(node, { y });
    y += node.height + gap;
  });
}
