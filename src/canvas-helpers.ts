import { BASE_PASTE_COLUMNS, CARD_GAP } from "./constants";
import type {
  CanvasLike,
  CanvasNodeDataLike,
  CanvasNodeLike,
  CardSize,
  Point,
} from "./types";

export type GridLayoutMetrics = {
  columns: number;
  startX: number;
  startY: number;
};

export type SelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        '[contenteditable]:not([contenteditable="false"])',
        ".cm-editor",
        ".canvas-node",
      ].join(","),
    ),
  );
}

export function getViewportCenter(canvas: CanvasLike): Point | null {
  if (!canvas.posFromEvt) {
    return null;
  }

  const rect = canvas.wrapperEl.getBoundingClientRect();

  const event = new MouseEvent("mousemove", {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });

  return canvas.posFromEvt(event);
}

export function createPasteGridLayout(
  count: number,
  origin: Point,
  size: CardSize,
): GridLayoutMetrics {
  if (count <= 0) {
    return {
      columns: 1,
      startX: origin.x,
      startY: origin.y,
    };
  }

  const columns = Math.min(
    count,
    Math.max(BASE_PASTE_COLUMNS, Math.ceil(Math.sqrt(count))),
  );
  const rows = Math.ceil(count / columns);
  const gridWidth = columns * size.width + (columns - 1) * CARD_GAP;
  const gridHeight = rows * size.height + (rows - 1) * CARD_GAP;

  return {
    columns,
    startX: origin.x - gridWidth / 2,
    startY: origin.y - gridHeight / 2,
  };
}

export function getGridPosition(
  index: number,
  layout: GridLayoutMetrics,
  size: CardSize,
): Point {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);

  return {
    x: layout.startX + column * (size.width + CARD_GAP),
    y: layout.startY + row * (size.height + CARD_GAP),
  };
}

export function getSelectedNodes(canvas: CanvasLike): CanvasNodeLike[] {
  const selectionData = canvas.getSelectionData?.();
  const nodes = canvas.nodes;

  if (!selectionData || !nodes) {
    return [];
  }

  const selectedNodes: CanvasNodeLike[] = [];

  for (const nodeData of selectionData.nodes) {
    const node = nodes.get(nodeData.id);

    if (node) {
      selectedNodes.push(node);
    }
  }

  return selectedNodes;
}

export function getSelectionBounds(
  nodes: readonly CanvasNodeLike[],
): SelectionBounds | null {
  if (nodes.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  return { minX, minY, maxX, maxY };
}

export function getSelectionCenter(nodes: readonly CanvasNodeLike[]): Point {
  const bounds = getSelectionBounds(nodes);

  if (!bounds) {
    return { x: 0, y: 0 };
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function sortNodesReadingOrder(
  nodes: CanvasNodeLike[],
): CanvasNodeLike[] {
  return nodes.sort((a, b) => {
    const verticalDifference = a.y - b.y;

    if (Math.abs(verticalDifference) > Math.min(a.height, b.height) / 2) {
      return verticalDifference;
    }

    return a.x - b.x;
  });
}

export function updateNodeGeometry(
  node: CanvasNodeLike,
  geometry: Partial<Pick<CanvasNodeDataLike, "x" | "y" | "width" | "height">>,
): void {
  node.setData(
    {
      ...node.getData(),
      ...geometry,
    },
    false,
  );
}
