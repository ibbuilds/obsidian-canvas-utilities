import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import {
  createPasteGridLayout,
  getGridPosition,
  getSelectedNodes,
  getViewportCenter,
  isEditablePasteTarget,
} from "./src/canvas-helpers";
import {
  CARD_SIZES,
  DEFAULT_CARD_SIZE,
  WEB_CARD_BATCH_SIZE,
} from "./src/constants";
import GapModal from "./src/gap-modal";
import { yieldToUi } from "./src/scheduler";
import {
  arrangeNodes,
  type GapDirection,
  matchNodeSizes,
  type SelectionLayout,
  type SizeMatchMode,
  setNodeGap,
} from "./src/selection";
import type {
  CanvasLike,
  CanvasNodeLike,
  CanvasViewLike,
  CardSize,
} from "./src/types";
import { extractExcalidrawEmbedUrls, extractHttpUrls } from "./src/urls";

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
      callback: () => void this.matchSelectedNodeSize("largest"),
    });

    this.addCommand({
      id: "match-selected-node-size-smallest",
      name: "Match selected node size — Smallest",
      callback: () => void this.matchSelectedNodeSize("smallest"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-row",
      name: "Arrange selected nodes — Row",
      callback: () => void this.arrangeSelectedNodes("row"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-column",
      name: "Arrange selected nodes — Column",
      callback: () => void this.arrangeSelectedNodes("column"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-grid",
      name: "Arrange selected nodes — Grid",
      callback: () => void this.arrangeSelectedNodes("grid"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-bento",
      name: "Arrange selected nodes — Bento",
      callback: () => void this.arrangeSelectedNodes("bento"),
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

  private async matchSelectedNodeSize(mode: SizeMatchMode): Promise<void> {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    await matchNodeSizes(selection.nodes, mode);
    this.commitNodeMutation(selection.canvas);
  }

  private async arrangeSelectedNodes(layout: SelectionLayout): Promise<void> {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    await arrangeNodes(selection.nodes, layout);
    this.commitNodeMutation(selection.canvas);
  }

  private promptSelectionGap(direction: GapDirection): void {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    new GapModal(this.app, `Set ${direction} gap`, (gap) => {
      void this.applySelectionGap(selection, direction, gap);
    }).open();
  }

  private async applySelectionGap(
    selection: { canvas: CanvasLike; nodes: CanvasNodeLike[] },
    direction: GapDirection,
    gap: number,
  ): Promise<void> {
    await setNodeGap(selection.nodes, direction, gap);
    this.commitNodeMutation(selection.canvas);
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

    const excalidraw = extractExcalidrawEmbedUrls(text);

    if (excalidraw.recognized) {
      if (excalidraw.urls.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      void this.createWebCards(canvas, excalidraw.urls, DEFAULT_CARD_SIZE);
      return;
    }

    const { validCount, urls } = extractHttpUrls(text);

    if (validCount < 2) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    void this.createWebCards(canvas, urls, DEFAULT_CARD_SIZE);
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

    await this.createWebCards(canvas, urls, size);
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

    const { recognized, urls } = extractExcalidrawEmbedUrls(text);

    if (!recognized || urls.length === 0) {
      new Notice("Clipboard does not contain valid Excalidraw web embeds");
      return;
    }

    await this.createWebCards(canvas, urls, DEFAULT_CARD_SIZE);
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

  private async createWebCards(
    canvas: CanvasLike,
    urls: string[],
    size: CardSize,
  ): Promise<void> {
    const origin = getViewportCenter(canvas);

    if (!origin) {
      new Notice("Unable to determine the Canvas viewport");
      return;
    }

    const layout = createPasteGridLayout(urls.length, origin, size);
    let createdCount = 0;

    try {
      for (let index = 0; index < urls.length; index += 1) {
        canvas.createLinkNode({
          pos: getGridPosition(index, layout, size),
          size,
          position: "center",
          url: urls[index],
          save: false,
          focus: false,
        });

        createdCount += 1;

        if (
          createdCount % WEB_CARD_BATCH_SIZE === 0 &&
          createdCount < urls.length
        ) {
          await yieldToUi();
        }
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
