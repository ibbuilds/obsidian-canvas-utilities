import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { createBentoGridPlan } from "./src/bento-grid";
import {
  createPasteGridLayout,
  getGridPosition,
  getSelectedNodes,
  getSelectionBounds,
  getViewportCenter,
  isEditablePasteTarget,
} from "./src/canvas-helpers";
import {
  CARD_SIZES,
  GROUP_PADDING,
  type SmartCardSizeName,
  WEB_CARD_BATCH_SIZE,
} from "./src/constants";
import GapModal from "./src/gap-modal";
import { yieldToUi } from "./src/scheduler";
import {
  type Alignment,
  alignNodes,
  arrangeNodes,
  type DistributionDirection,
  distributeNodes,
  type GapDirection,
  matchNodeSizes,
  type SelectionLayout,
  type SizeMatchMode,
  setNodeGap,
  setNodeSizePreset,
} from "./src/selection";
import SelectionToolbarController from "./src/selection-toolbar";
import type {
  CanvasLike,
  CanvasNodeLike,
  CanvasViewLike,
  CardSize,
} from "./src/types";
import { extractExcalidrawEmbedUrls, extractHttpUrls } from "./src/urls";

type SelectionMutation = (
  canvas: CanvasLike,
  nodes: CanvasNodeLike[],
) => Promise<void> | void;

export default class CanvasUtilitiesPlugin extends Plugin {
  private readonly registeredCanvasWrappers = new WeakSet<HTMLElement>();
  private readonly selectionToolbar = new SelectionToolbarController({
    layout: (layout) => void this.arrangeSelectedNodes(layout),
    align: (alignment) => void this.alignSelectedNodes(alignment),
    distribute: (direction) => void this.distributeSelectedNodes(direction),
    sizePreset: (preset) => void this.setSelectedNodeSizePreset(preset),
    matchSize: (mode) => void this.matchSelectedNodeSize(mode),
    group: () => void this.groupSelection(),
  });
  private mutationChain = Promise.resolve();

  override onload(): void {
    this.addCommand({
      id: "paste-urls-as-web-cards",
      name: "Paste URLs as bento grid",
      callback: () => this.pasteClipboardUrlsBento(),
    });

    this.addCommand({
      id: "paste-excalidraw-embeds-as-web-cards",
      name: "Paste Excalidraw embeds as bento grid",
      callback: () => this.pasteExcalidrawEmbedsAsWebCards(),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-compact",
      name: "Paste URLs as web cards — Compact",
      callback: () => this.pasteClipboardUrlsFixed(CARD_SIZES.compact),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-desktop",
      name: "Paste URLs as web cards — Desktop",
      callback: () => this.pasteClipboardUrlsFixed(CARD_SIZES.desktop),
    });

    this.addCommand({
      id: "paste-urls-as-web-cards-large-desktop",
      name: "Paste URLs as web cards — Large Desktop",
      callback: () => this.pasteClipboardUrlsFixed(CARD_SIZES.largeDesktop),
    });

    this.addCommand({
      id: "arrange-selected-nodes-bento",
      name: "Arrange selected nodes — Bento grid",
      callback: () => void this.arrangeSelectedNodes("bento"),
    });

    this.addCommand({
      id: "arrange-selected-nodes-grid",
      name: "Arrange selected nodes — Even grid",
      callback: () => void this.arrangeSelectedNodes("grid"),
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
      id: "set-selected-nodes-horizontal-gap",
      name: "Set selected node gap — Horizontal",
      callback: () => this.promptSelectionGap("horizontal"),
    });

    this.addCommand({
      id: "set-selected-nodes-vertical-gap",
      name: "Set selected node gap — Vertical",
      callback: () => this.promptSelectionGap("vertical"),
    });

    this.addCommand({
      id: "group-selected-nodes",
      name: "Group selected nodes",
      callback: () => void this.groupSelection(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.registerCanvasIntegrations();
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.registerCanvasIntegrations();
      }),
    );
  }

  private registerCanvasIntegrations(): void {
    const leaves = this.app.workspace.getLeavesOfType("canvas");

    for (const leaf of leaves) {
      const canvas = this.getCanvasFromLeaf(leaf);

      if (!canvas) {
        continue;
      }

      const wrapper = canvas.wrapperEl;

      if (this.registeredCanvasWrappers.has(wrapper)) {
        this.selectionToolbar.refresh(canvas);
        continue;
      }

      this.registeredCanvasWrappers.add(wrapper);

      const pasteHandler = (event: ClipboardEvent): void => {
        this.handleCanvasPaste(event, canvas);
      };

      wrapper.addEventListener("paste", pasteHandler, true);
      const detachToolbar = this.selectionToolbar.attach(canvas);

      this.register(() => {
        wrapper.removeEventListener("paste", pasteHandler, true);
        detachToolbar();
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

      void this.createBentoWebCards(canvas, excalidraw.urls);
      return;
    }

    const { validCount, urls } = extractHttpUrls(text);

    if (validCount < 2) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    void this.createBentoWebCards(canvas, urls);
  }

  private async pasteClipboardUrlsBento(): Promise<void> {
    const canvas = this.getActiveCanvas();

    if (!canvas) {
      new Notice("Open a Canvas first");
      return;
    }

    const urls = await this.readClipboardUrls();

    if (!urls) {
      return;
    }

    await this.createBentoWebCards(canvas, urls);
  }

  private async pasteClipboardUrlsFixed(size: CardSize): Promise<void> {
    const canvas = this.getActiveCanvas();

    if (!canvas) {
      new Notice("Open a Canvas first");
      return;
    }

    const urls = await this.readClipboardUrls();

    if (!urls) {
      return;
    }

    await this.createFixedWebCards(canvas, urls, size);
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

    await this.createBentoWebCards(canvas, urls);
  }

  private async readClipboardUrls(): Promise<string[] | null> {
    const text = await this.readClipboardText();

    if (text === null) {
      return null;
    }

    const { urls } = extractHttpUrls(text);

    if (urls.length === 0) {
      new Notice("Clipboard does not contain valid URLs");
      return null;
    }

    return urls;
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

  private async createBentoWebCards(
    canvas: CanvasLike,
    urls: string[],
  ): Promise<void> {
    const origin = getViewportCenter(canvas);

    if (!origin) {
      new Notice("Unable to determine the Canvas viewport");
      return;
    }

    const plan = createBentoGridPlan(urls.length, origin);
    const before = canvas.getData?.();
    const createdNodes: CanvasNodeLike[] = [];

    this.emitBatchEvent("start", canvas, "create:bento");

    try {
      for (let index = 0; index < urls.length; index += 1) {
        const tile = plan.tiles[index];

        createdNodes.push(
          canvas.createLinkNode({
            pos: tile.pos,
            size: tile.size,
            position: "center",
            url: urls[index],
            save: false,
            focus: false,
          }),
        );

        if (
          createdNodes.length % WEB_CARD_BATCH_SIZE === 0 &&
          createdNodes.length < urls.length
        ) {
          await yieldToUi();
        }
      }
    } catch (error) {
      console.error("[Canvas Utilities] Failed to create web cards", error);
      new Notice("Failed to create all web cards");
    } finally {
      this.finishCreatedNodes(canvas, createdNodes, before);
      this.emitBatchEvent("end", canvas, "create:bento", createdNodes);
    }
  }

  private async createFixedWebCards(
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
    const before = canvas.getData?.();
    const createdNodes: CanvasNodeLike[] = [];

    this.emitBatchEvent("start", canvas, "create:fixed-grid");

    try {
      for (let index = 0; index < urls.length; index += 1) {
        createdNodes.push(
          canvas.createLinkNode({
            pos: getGridPosition(index, layout, size),
            size,
            position: "center",
            url: urls[index],
            save: false,
            focus: false,
          }),
        );

        if (
          createdNodes.length % WEB_CARD_BATCH_SIZE === 0 &&
          createdNodes.length < urls.length
        ) {
          await yieldToUi();
        }
      }
    } catch (error) {
      console.error("[Canvas Utilities] Failed to create web cards", error);
      new Notice("Failed to create all web cards");
    } finally {
      this.finishCreatedNodes(canvas, createdNodes, before);
      this.emitBatchEvent("end", canvas, "create:fixed-grid", createdNodes);
    }
  }

  private finishCreatedNodes(
    canvas: CanvasLike,
    createdNodes: CanvasNodeLike[],
    before: unknown,
  ): void {
    if (createdNodes.length === 0) {
      return;
    }

    try {
      if (before !== undefined) {
        canvas.pushHistory?.(before);
      }

      canvas.requestSave(false);
      this.selectNodes(canvas, createdNodes);
      this.selectionToolbar.refresh(canvas);
    } catch (error) {
      console.error("[Canvas Utilities] Failed to finalize web cards", error);
      new Notice("Failed to save the Canvas");
    }
  }

  private selectNodes(canvas: CanvasLike, nodes: CanvasNodeLike[]): void {
    if (!canvas.updateSelection || !canvas.selection) {
      return;
    }

    canvas.updateSelection(() => {
      canvas.selection = new Set(nodes);
    });
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

  private queueSelectionMutation(
    reason: string,
    mutation: SelectionMutation,
  ): Promise<void> {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return Promise.resolve();
    }

    const { canvas, nodes } = selection;

    this.mutationChain = this.mutationChain
      .catch((error) => {
        console.error("[Canvas Utilities] Previous mutation failed", error);
      })
      .then(async () => {
        const before = canvas.getData?.();

        this.emitBatchEvent("start", canvas, reason, nodes);
        await mutation(canvas, nodes);

        if (before !== undefined) {
          canvas.pushHistory?.(before);
        }

        canvas.requestSave(false);
        this.emitGeometryChanged(canvas, nodes, reason);
        this.emitBatchEvent("end", canvas, reason, nodes);
        this.selectionToolbar.refresh(canvas);
      })
      .catch((error) => {
        console.error("[Canvas Utilities] Selection mutation failed", error);
        new Notice("Canvas operation failed");
      });

    return this.mutationChain;
  }

  private matchSelectedNodeSize(mode: SizeMatchMode): Promise<void> {
    return this.queueSelectionMutation("match-size", (_canvas, nodes) =>
      matchNodeSizes(nodes, mode),
    );
  }

  private setSelectedNodeSizePreset(preset: SmartCardSizeName): Promise<void> {
    return this.queueSelectionMutation("size-preset", (_canvas, nodes) =>
      setNodeSizePreset(nodes, preset),
    );
  }

  private arrangeSelectedNodes(layout: SelectionLayout): Promise<void> {
    return this.queueSelectionMutation(`layout:${layout}`, (_canvas, nodes) =>
      arrangeNodes(nodes, layout),
    );
  }

  private alignSelectedNodes(alignment: Alignment): Promise<void> {
    return this.queueSelectionMutation(`align:${alignment}`, (_canvas, nodes) =>
      alignNodes(nodes, alignment),
    );
  }

  private distributeSelectedNodes(
    direction: DistributionDirection,
  ): Promise<void> {
    return this.queueSelectionMutation(
      `distribute:${direction}`,
      (_canvas, nodes) => distributeNodes(nodes, direction),
    );
  }

  private promptSelectionGap(direction: GapDirection): void {
    const selection = this.getMutableSelectedNodes();

    if (!selection) {
      return;
    }

    new GapModal(this.app, `Set ${direction} gap`, (gap) => {
      void this.queueSelectionMutation(`gap:${direction}`, (_canvas, nodes) =>
        setNodeGap(nodes, direction, gap),
      );
    }).open();
  }

  private groupSelection(): Promise<void> {
    return this.queueSelectionMutation("group", (canvas, nodes) => {
      if (!canvas.createGroupNode) {
        new Notice("Grouping is not available in this Canvas version");
        return;
      }

      const bounds = getSelectionBounds(nodes);

      if (!bounds) {
        return;
      }

      const group = canvas.createGroupNode({
        pos: {
          x: bounds.minX - GROUP_PADDING,
          y: bounds.minY - GROUP_PADDING,
        },
        size: {
          width: bounds.maxX - bounds.minX + GROUP_PADDING * 2,
          height: bounds.maxY - bounds.minY + GROUP_PADDING * 2,
        },
        save: false,
        focus: false,
      });

      this.selectNodes(canvas, [group]);
    });
  }

  private emitBatchEvent(
    phase: "start" | "end",
    canvas: CanvasLike,
    reason: string,
    nodes: CanvasNodeLike[] = [],
  ): void {
    this.app.workspace.trigger(`canvas-utilities:batch-${phase}`, canvas, {
      reason,
      nodeIds: nodes.map((node) => node.id),
    });
  }

  private emitGeometryChanged(
    canvas: CanvasLike,
    nodes: CanvasNodeLike[],
    reason: string,
  ): void {
    this.app.workspace.trigger("canvas-utilities:geometry-changed", canvas, {
      reason,
      nodeIds: nodes.map((node) => node.id),
    });
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
