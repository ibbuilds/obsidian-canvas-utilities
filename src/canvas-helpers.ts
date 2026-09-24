import { CARD_GAP, MAX_COLUMNS } from "./constants";
import type {
  CanvasLike,
  CanvasNodeDataLike,
  CanvasNodeLike,
  CardSize,
  Point,
} from "./types";

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

export function calculateGridLayout(
  count: number,
  origin: Point,
  size: CardSize,
): Point[] {
  const columns = Math.min(count, MAX_COLUMNS);
  const rows = Math.ceil(count / columns);

  const gridWidth = columns * size.width + (columns - 1) * CARD_GAP;
  const gridHeight = rows * size.height + (rows - 1) * CARD_GAP;

  const startX = origin.x - gridWidth / 2;
  const startY = origin.y - gridHeight / 2;

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      x: startX + column * (size.width + CARD_GAP),
      y: startY + row * (size.height + CARD_GAP),
    };
  });
}

export function getSelectedNodes(canvas: CanvasLike): CanvasNodeLike[] {
  const selectionData = canvas.getSelectionData?.();
  const nodes = canvas.nodes;

  if (!selectionData || !nodes) {
    return [];
  }

  return selectionData.nodes
    .map((nodeData) => nodes.get(nodeData.id))
    .filter((node): node is CanvasNodeLike => node !== undefined);
}

export function getSelectionCenter(nodes: CanvasNodeLike[]): Point {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

export function sortNodesReadingOrder(
  nodes: CanvasNodeLike[],
): CanvasNodeLike[] {
  return [...nodes].sort((a, b) => {
    const verticalDifference = a.y - b.y;

    if (Math.abs(verticalDifference) > Math.min(a.height, b.height) / 2) {
      return verticalDifference;
    }

    return a.x - b.x;
  });
}

export function updateNodeGeometry(
  node: CanvasNodeLike,
  geometry: Partial<
    Pick<CanvasNodeDataLike, "x" | "y" | "width" | "height">
  >,
): void {
  node.setData(
    {
      ...node.getData(),
      ...geometry,
    },
    false,
  );
}
