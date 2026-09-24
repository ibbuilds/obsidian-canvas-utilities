import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";

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

type CanvasLike = {
  wrapperEl: HTMLElement;
  posFromEvt?(event: MouseEvent): Point;
  createLinkNode(options: CanvasLinkNodeOptions): unknown;
  requestSave(immediate?: boolean): void;
};

type CanvasViewLike = {
  getViewType(): string;
  canvas?: CanvasLike;
};

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
      id: "paste-urls-as-web-cards-compact",
      name: "Paste URLs as web cards — Compact",
      callback: () => this.pasteClipboardUrls(CARD_SIZES.compact),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-large-desktop",
      name: "Paste URLs as web cards — Large Desktop",
      callback: () => this.pasteClipboardUrls(CARD_SIZES.largeDesktop),
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
