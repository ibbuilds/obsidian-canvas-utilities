import { type App, Modal, Notice, Plugin, type WorkspaceLeaf } from "obsidian";

type Point = {
  x: number;
  y: number;
};

type CardSize = {
  width: number;
  height: number;
};

type HttpUrlExtraction = {
  validCount: number;
  urls: string[];
};

const CARD_SIZES = {
  compact: { width: 800, height: 500 },
  desktop: { width: 1280, height: 800 },
  largeDesktop: { width: 1440, height: 900 },
} satisfies Record<string, CardSize>;

const DEFAULT_CARD_SIZE = CARD_SIZES.desktop;
const CARD_GAP = 60;
const MAX_COLUMNS = 4;

type CanvasLinkNodeOptions = {
  pos: Point;
  size: CardSize;
  position: "center";
  url: string;
  save: boolean;
  focus: boolean;
};

type CanvasNodeDataLike = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

type CanvasNodeLike = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  getData(): CanvasNodeDataLike;
  setData(data: CanvasNodeDataLike, addHistory?: boolean): void;
};

type CanvasSelectionDataLike = {
  nodes: CanvasNodeDataLike[];
};

type CanvasLike = {
  wrapperEl: HTMLElement;
  readonly?: boolean;
  nodes?: Map<string, CanvasNodeLike>;
  posFromEvt?(event: MouseEvent): Point;
  createLinkNode(options: CanvasLinkNodeOptions): unknown;
  getSelectionData?(): CanvasSelectionDataLike;
  getData?(): unknown;
  pushHistory?(data: unknown): void;
  requestSave(immediate?: boolean): void;
};

type CanvasViewLike = {
  getViewType(): string;
  canvas?: CanvasLike;
};

class GapModal extends Modal {
  constructor(
    app: App,
    private readonly titleText: string,
    private readonly onSubmit: (gap: number) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.titleText);

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(CARD_GAP);
    input.placeholder = "Gap in Canvas units";
    input.style.width = "100%";

    const submit = (): void => {
      const gap = Number(input.value);

      if (!Number.isFinite(gap) || gap < 0) {
        new Notice("Gap must be a non-negative number");
        return;
      }

      this.onSubmit(gap);
      this.close();
    };

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Apply";
    button.classList.add("mod-cta");
    button.addEventListener("click", submit);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submit();
      }
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.marginTop = "12px";
    actions.append(button);

    this.contentEl.replaceChildren(input, actions);
    input.focus();
    input.select();
  }

  override onClose(): void {
    this.contentEl.replaceChildren();
  }
}

function getSelectedNodes(canvas: CanvasLike): CanvasNodeLike[] {
  const selectionData = canvas.getSelectionData?.();
  const nodes = canvas.nodes;

  if (!selectionData || !nodes) {
    return [];
  }

  return selectionData.nodes
    .map((nodeData) => nodes.get(nodeData.id))
    .filter((node): node is CanvasNodeLike => node !== undefined);
}

function getSelectionCenter(nodes: CanvasNodeLike[]): Point {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function sortNodesReadingOrder(nodes: CanvasNodeLike[]): CanvasNodeLike[] {
  return [...nodes].sort((a, b) => {
    const verticalDifference = a.y - b.y;

    if (Math.abs(verticalDifference) > Math.min(a.height, b.height) / 2) {
      return verticalDifference;
    }

    return a.x - b.x;
  });
}

function updateNodeGeometry(
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

function normalizeHttpUrl(candidate: string): string | null {
  const cleaned = candidate.replace(/[),.;]+$/g, "");

  try {
    const url = new URL(cleaned);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function extractHttpUrls(text: string): HttpUrlExtraction {
  const matches = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  const urls = new Set<string>();
  let validCount = 0;

  for (const match of matches) {
    const url = normalizeHttpUrl(match);

    if (!url) {
      continue;
    }

    validCount += 1;
    urls.add(url);
  }

  return {
    validCount,
    urls: [...urls],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractExcalidrawEmbedUrls(text: string): string[] {
  let clipboard: unknown;

  try {
    clipboard = JSON.parse(text);
  } catch {
    return [];
  }

  if (
    !isRecord(clipboard) ||
    clipboard.type !== "excalidraw/clipboard" ||
    !Array.isArray(clipboard.elements)
  ) {
    return [];
  }

  const urls = new Set<string>();

  for (const element of clipboard.elements) {
    if (
      !isRecord(element) ||
      element.type !== "embeddable" ||
      typeof element.link !== "string"
    ) {
      continue;
    }

    const url = normalizeHttpUrl(element.link);

    if (url) {
      urls.add(url);
    }
  }

  return [...urls];
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
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

function getViewportCenter(canvas: CanvasLike): Point | null {
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

function calculateGridLayout(
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

export default class CanvasUtilitiesPlugin extends Plugin {
  private readonly registeredCanvasWrappers = new WeakSet<HTMLElement>();

  override onload(): void {
    this.addCommand({
      id: "paste-urls-as-web-cards",
      name: "Paste URLs as web cards",
      callback: () => this.pasteClipboardUrls(CARD_SIZES.desktop),
    });

    this.addCommand({
      id: "paste-excalidraw-embeds-as-web-cards",
      name: "Paste Excalidraw embeds as web cards",
      callback: () => this.pasteExcalidrawEmbedsAsWebCards(),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-compact",
      name: "Paste URLs as web cards — Compact",
      callback: () => this.pasteClipboardUrls(CARD_SIZES.compact),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-large-desktop",
      name: "Paste URLs as web cards — Large Desktop",
      callback: () => this.pasteClipboardUrls(CARD_SIZES.largeDesktop),
    });

    this.addCommand({
      id: "match-selected-node-size-largest",
      name: "Match selected node size — Largest",
      callback: () => this.matchSelectedNodeSize("largest"),
    });

    this.addCommand({
      id: "match-selected-node-size-smallest",
      name: "Match selected node size — Smallest",
      callback: () => this.matchSelectedNodeSize("smallest"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-row",
      name: "Arrange selected nodes — Row",
      callback: () => this.arrangeSelectedNodes("row"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-column",
      name: "Arrange selected nodes — Column",
      callback: () => this.arrangeSelectedNodes("column"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-grid",
      name: "Arrange selected nodes — Grid",
      callback: () => this.arrangeSelectedNodes("grid"),
    });

    this.addCommand({
      id: "set-selected-nodes-horizontal-gap",
      name: "Set selected node gap — Horizontal",
      callback: () => this.promptSelectionGap("horizontal"),
    });

    this.addCommand({
      id: "set-selected-nodes-vertical-gap",
      name: "Set selected node gap — Vertical",
      callback: () => this.promptSelectionGap("vertical"),
    });

    this.app.workspace.onLayoutReady(() => {
      this.registerCanvasPasteHandlers();
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.registerCanvasPasteHandlers();
      }),
    );
  }

  private getMutableSelectedNodes(): {
    canvas: CanvasLike;
    nodes: CanvasNodeLike[];
  } | null {
    const canvas = this.getActiveCanvas();

    if (!canvas) {
      new Notice("Open a Canvas first");
      return null;
    }

    if (canvas.readonly) {
      new Notice("Canvas is read-only");
      return null;
    }

    const nodes = getSelectedNodes(canvas);

    if (nodes.length < 2) {
      new Notice("Select at least two Canvas nodes");
      return null;
    }

    return { canvas, nodes };
  }

  private commitNodeMutation(canvas: CanvasLike): void {
    const data = canvas.getData?.();

    if (data !== undefined) {
      canvas.pushHistory?.(data);
    }

    canvas.requestSave(false);
  }

  private matchSelectedNodeSize(mode: "largest" | "smallest"): void {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    const { canvas, nodes } = selection;
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

    this.commitNodeMutation(canvas);
  }

  private arrangeSelectedNodes(layout: "row" | "column" | "grid"): void {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    const { canvas, nodes } = selection;
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
    } else if (layout === "column") {
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
    } else {
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
        rowHeights.reduce((sum, height) => sum + height, 0) +
        CARD_GAP * (rows - 1);

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

    this.commitNodeMutation(canvas);
  }

  private promptSelectionGap(direction: "horizontal" | "vertical"): void {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    new GapModal(
      this.app,
      `Set ${direction} gap`,
      (gap) => this.setSelectionGap(selection.canvas, selection.nodes, direction, gap),
    ).open();
  }

  private setSelectionGap(
    canvas: CanvasLike,
    nodes: CanvasNodeLike[],
    direction: "horizontal" | "vertical",
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
    } else {
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

    this.commitNodeMutation(canvas);
  }

  private registerCanvasPasteHandlers(): void {
    const leaves = this.app.workspace.getLeavesOfType("canvas");

    for (const leaf of leaves) {
      const canvas = this.getCanvasFromLeaf(leaf);

      if (!canvas) {
        continue;
      }

      const wrapper = canvas.wrapperEl;

      if (this.registeredCanvasWrappers.has(wrapper)) {
        continue;
      }

      this.registeredCanvasWrappers.add(wrapper);

      const handler = (event: ClipboardEvent): void => {
        this.handleCanvasPaste(event, canvas);
      };

      wrapper.addEventListener("paste", handler, true);

      this.register(() => {
        wrapper.removeEventListener("paste", handler, true);
      });
    }
  }

  private handleCanvasPaste(event: ClipboardEvent, canvas: CanvasLike): void {
    if (isEditablePasteTarget(event.target)) {
      return;
    }

    const text = event.clipboardData?.getData("text/plain");

    if (!text) {
      return;
    }

    const { validCount, urls } = extractHttpUrls(text);

    // Preserve Obsidian's normal behavior unless the clipboard actually
    // contains two or more valid HTTP(S) URL occurrences.
    if (validCount < 2) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    this.createWebCards(canvas, urls, DEFAULT_CARD_SIZE);
  }

  private async pasteClipboardUrls(size: CardSize): Promise<void> {
    const canvas = this.getActiveCanvas();

    if (!canvas) {
      new Notice("Open a Canvas first");
      return;
    }

    const text = await this.readClipboardText();

    if (text === null) {
      return;
    }

    const { urls } = extractHttpUrls(text);

    if (urls.length === 0) {
      new Notice("Clipboard does not contain valid URLs");
      return;
    }

    this.createWebCards(canvas, urls, size);
  }

  private async pasteExcalidrawEmbedsAsWebCards(): Promise<void> {
    const canvas = this.getActiveCanvas();

    if (!canvas) {
      new Notice("Open a Canvas first");
      return;
    }

    const text = await this.readClipboardText();

    if (text === null) {
      return;
    }

    const urls = extractExcalidrawEmbedUrls(text);

    if (urls.length === 0) {
      new Notice("Clipboard does not contain valid Excalidraw web embeds");
      return;
    }

    this.createWebCards(canvas, urls, DEFAULT_CARD_SIZE);
  }

  private async readClipboardText(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.error("[Canvas Utilities] Failed to read clipboard", error);
      new Notice("Unable to read the clipboard");
      return null;
    }
  }

  private createWebCards(
    canvas: CanvasLike,
    urls: string[],
    size: CardSize,
  ): void {
    const origin = getViewportCenter(canvas);

    if (!origin) {
      new Notice("Unable to determine the Canvas viewport");
      return;
    }

    const positions = calculateGridLayout(urls.length, origin, size);
    let createdCount = 0;

    try {
      for (const [index, url] of urls.entries()) {
        canvas.createLinkNode({
          pos: positions[index],
          size,
          position: "center",
          url,
          save: false,
          focus: false,
        });

        createdCount += 1;
      }
    } catch (error) {
      console.error("[Canvas Utilities] Failed to create web cards", error);
      new Notice("Failed to create all web cards");
    } finally {
      if (createdCount > 0) {
        try {
          canvas.requestSave(false);
        } catch (error) {
          console.error("[Canvas Utilities] Failed to save Canvas", error);
          new Notice("Failed to save the Canvas");
        }
      }
    }
  }

  private getCanvasFromLeaf(leaf: WorkspaceLeaf | null): CanvasLike | null {
    if (leaf?.view.getViewType() !== "canvas") {
      return null;
    }

    return (leaf.view as CanvasViewLike).canvas ?? null;
  }

  private getActiveCanvas(): CanvasLike | null {
    const recentCanvas = this.getCanvasFromLeaf(
      this.app.workspace.getMostRecentLeaf(),
    );

    if (recentCanvas) {
      return recentCanvas;
    }

    const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");

    if (canvasLeaves.length !== 1) {
      return null;
    }

    return this.getCanvasFromLeaf(canvasLeaves[0]);
  }
}
