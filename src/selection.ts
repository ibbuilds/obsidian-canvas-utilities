import {
  getSelectionCenter,
  sortNodesReadingOrder,
  updateNodeGeometry,
} from "./canvas-helpers";
import { CARD_GAP, MAX_COLUMNS } from "./constants";
import type { CanvasNodeLike } from "./types";

export type SizeMatchMode = "largest" | "smallest";
export type SelectionLayout = "row" | "column" | "grid";
export type GapDirection = "horizontal" | "vertical";

export function matchNodeSizes(
  nodes: CanvasNodeLike[],
  mode: SizeMatchMode,
): void {
  const target = nodes.reduce((candidate, node) => {
    const candidateArea = candidate.width * candidate.height;
    const nodeArea = node.width * node.height;

    return mode === "largest"
      ? nodeArea > candidateArea
        ? node
        : candidate
      : nodeArea < candidateArea
        ? node
        : candidate;
  });

  for (const node of nodes) {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;

    updateNodeGeometry(node, {
      x: centerX - target.width / 2,
      y: centerY - target.height / 2,
      width: target.width,
      height: target.height,
    });
  }
}

export function arrangeNodes(
  nodes: CanvasNodeLike[],
  layout: SelectionLayout,
): void {
  const orderedNodes =
    layout === "column"
      ? [...nodes].sort((a, b) => a.y - b.y)
      : layout === "row"
        ? [...nodes].sort((a, b) => a.x - b.x)
        : sortNodesReadingOrder(nodes);

  const center = getSelectionCenter(nodes);

  if (layout === "row") {
    const totalWidth =
      orderedNodes.reduce((sum, node) => sum + node.width, 0) +
      CARD_GAP * (orderedNodes.length - 1);
    let x = center.x - totalWidth / 2;

    for (const node of orderedNodes) {
      updateNodeGeometry(node, {
        x,
        y: center.y - node.height / 2,
      });
      x += node.width + CARD_GAP;
    }

    return;
  }

  if (layout === "column") {
    const totalHeight =
      orderedNodes.reduce((sum, node) => sum + node.height, 0) +
      CARD_GAP * (orderedNodes.length - 1);
    let y = center.y - totalHeight / 2;

    for (const node of orderedNodes) {
      updateNodeGeometry(node, {
        x: center.x - node.width / 2,
        y,
      });
      y += node.height + CARD_GAP;
    }

    return;
  }

  const columns = Math.min(
    MAX_COLUMNS,
    Math.ceil(Math.sqrt(orderedNodes.length)),
  );
  const rows = Math.ceil(orderedNodes.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  for (const [index, node] of orderedNodes.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], node.width);
    rowHeights[row] = Math.max(rowHeights[row], node.height);
  }

  const gridWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) +
    CARD_GAP * (columns - 1);
  const gridHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) + CARD_GAP * (rows - 1);

  const columnOffsets: number[] = [];
  const rowOffsets: number[] = [];
  let offset = center.x - gridWidth / 2;

  for (const width of columnWidths) {
    columnOffsets.push(offset);
    offset += width + CARD_GAP;
  }

  offset = center.y - gridHeight / 2;

  for (const height of rowHeights) {
    rowOffsets.push(offset);
    offset += height + CARD_GAP;
  }

  for (const [index, node] of orderedNodes.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);

    updateNodeGeometry(node, {
      x: columnOffsets[column] + (columnWidths[column] - node.width) / 2,
      y: rowOffsets[row] + (rowHeights[row] - node.height) / 2,
    });
  }
}

export function setNodeGap(
  nodes: CanvasNodeLike[],
  direction: GapDirection,
  gap: number,
): void {
  const center = getSelectionCenter(nodes);

  if (direction === "horizontal") {
    const orderedNodes = [...nodes].sort((a, b) => a.x - b.x);
    const totalWidth =
      orderedNodes.reduce((sum, node) => sum + node.width, 0) +
      gap * (orderedNodes.length - 1);
    let x = center.x - totalWidth / 2;

    for (const node of orderedNodes) {
      updateNodeGeometry(node, { x });
      x += node.width + gap;
    }

    return;
  }

  const orderedNodes = [...nodes].sort((a, b) => a.y - b.y);
  const totalHeight =
    orderedNodes.reduce((sum, node) => sum + node.height, 0) +
    gap * (orderedNodes.length - 1);
  let y = center.y - totalHeight / 2;

  for (const node of orderedNodes) {
    updateNodeGeometry(node, { y });
    y += node.height + gap;
  }
}
