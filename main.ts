import { Notice, Plugin } from "obsidian";

type CardSize = {
  width: number;
  height: number;
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
  pos: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  position: "center";
  url: string;
  save: boolean;
  focus: boolean;
};

type CanvasLike = {
  wrapperEl: HTMLElement;
  posFromEvt?(event: MouseEvent): {
    x: number;
    y: number;
  };
  createLinkNode(options: CanvasLinkNodeOptions): unknown;
  requestSave(immediate?: boolean): void;
};

type CanvasViewLike = {
  getViewType(): string;
  canvas?: CanvasLike;
};

function extractHttpUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  const urls = new Set<string>();

  for (const match of matches) {
    const cleaned = match.replace(/[),.;]+$/g, "");

    try {
      const url = new URL(cleaned);

      if (url.protocol === "http:" || url.protocol === "https:") {
        urls.add(url.href);
      }
    } catch {
      // Ignore malformed URLs.
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

function getViewportCenter(canvas: CanvasLike): { x: number; y: number } {
  const rect = canvas.wrapperEl.getBoundingClientRect();

  const event = new MouseEvent("mousemove", {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  });

  return canvas.posFromEvt?.(event) ?? { x: 0, y: 0 };
}

function calculateGridLayout(
  count: number,
  origin: { x: number; y: number },
  size: CardSize,
): { x: number; y: number }[] {
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
      const canvas = (leaf.view as CanvasViewLike).canvas;

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

    const urls = extractHttpUrls(text);

    if (urls.length < 2) {
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

    const text = await navigator.clipboard.readText();
    const urls = extractHttpUrls(text);

    if (urls.length === 0) {
      new Notice("Clipboard does not contain valid URLs");
      return;
    }

    this.createWebCards(canvas, urls, size);
  }

  private createWebCards(
    canvas: CanvasLike,
    urls: string[],
    size: CardSize,
  ): void {
    const origin = getViewportCenter(canvas);
    const positions = calculateGridLayout(urls.length, origin, size);

    for (const [index, url] of urls.entries()) {
      canvas.createLinkNode({
        pos: positions[index],
        size: {
          width: size.width,
          height: size.height,
        },
        position: "center",
        url,
        save: false,
        focus: false,
      });
    }

    canvas.requestSave(false);
  }

  private getActiveCanvas(): CanvasLike | null {
    const leaf = this.app.workspace.getMostRecentLeaf();

    if (leaf?.view.getViewType() !== "canvas") {
      return null;
    }

    return (leaf.view as CanvasViewLike).canvas ?? null;
  }
}
