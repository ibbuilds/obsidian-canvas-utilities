import { Menu, setIcon, setTooltip } from "obsidian";
import type { SmartCardSizeName } from "./constants";
import type {
  Alignment,
  DistributionDirection,
  SelectionLayout,
  SizeMatchMode,
} from "./selection";
import type { CanvasLike } from "./types";

export type SelectionToolbarActions = {
  layout(layout: SelectionLayout): void;
  align(alignment: Alignment): void;
  distribute(direction: DistributionDirection): void;
  sizePreset(preset: SmartCardSizeName): void;
  matchSize(mode: SizeMatchMode): void;
  group(): void;
};

const TOOLBAR_IDS = [
  "canvas-utilities-layout",
  "canvas-utilities-align",
  "canvas-utilities-size",
  "canvas-utilities-group",
] as const;

function addMenuItem(menu: Menu, title: string, callback: () => void): void {
  menu.addItem((item) => {
    item.setTitle(title).onClick(callback);
  });
}

function createToolbarButton(
  menuEl: HTMLElement,
  id: string,
  label: string,
  icon: string,
  callback: (event: MouseEvent) => void,
): HTMLButtonElement {
  const button = menuEl.ownerDocument.createElement("button");
  button.type = "button";
  button.id = id;
  button.classList.add("clickable-icon");
  setIcon(button, icon);
  setTooltip(button, label, { placement: "top" });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback(event);
  });

  return button;
}

export default class SelectionToolbarController {
  private readonly observers = new WeakMap<HTMLElement, MutationObserver>();

  constructor(private readonly actions: SelectionToolbarActions) {}

  attach(canvas: CanvasLike): () => void {
    const menuEl = canvas.menu?.menuEl;

    if (!menuEl || this.observers.has(menuEl)) {
      return () => {};
    }

    const observer = new MutationObserver(() => {
      queueMicrotask(() => this.refresh(canvas));
    });

    observer.observe(menuEl, {
      childList: true,
    });

    this.observers.set(menuEl, observer);
    this.refresh(canvas);

    return () => {
      observer.disconnect();
      this.observers.delete(menuEl);
      this.removeButtons(menuEl);
    };
  }

  refresh(canvas: CanvasLike): void {
    const menuEl = canvas.menu?.menuEl;

    if (!menuEl) {
      return;
    }

    const selectedCount = canvas.getSelectionData?.().nodes.length ?? 0;

    if (canvas.readonly || selectedCount < 2) {
      this.removeButtons(menuEl);
      return;
    }

    if (!menuEl.querySelector("#canvas-utilities-layout")) {
      menuEl.append(
        createToolbarButton(
          menuEl,
          "canvas-utilities-layout",
          "Arrange selection",
          "layout-grid",
          (event) => this.showLayoutMenu(event),
        ),
      );
    }

    if (!menuEl.querySelector("#canvas-utilities-align")) {
      menuEl.append(
        createToolbarButton(
          menuEl,
          "canvas-utilities-align",
          "Align and distribute",
          "align-center",
          (event) => this.showAlignMenu(event),
        ),
      );
    }

    if (!menuEl.querySelector("#canvas-utilities-size")) {
      menuEl.append(
        createToolbarButton(
          menuEl,
          "canvas-utilities-size",
          "Resize selection",
          "scaling",
          (event) => this.showSizeMenu(event),
        ),
      );
    }

    if (!menuEl.querySelector("#canvas-utilities-group")) {
      menuEl.append(
        createToolbarButton(
          menuEl,
          "canvas-utilities-group",
          "Group selection",
          "group",
          () => this.actions.group(),
        ),
      );
    }
  }

  private showLayoutMenu(event: MouseEvent): void {
    const menu = new Menu();

    addMenuItem(menu, "Moodboard", () => this.actions.layout("moodboard"));
    addMenuItem(menu, "Bento", () => this.actions.layout("bento"));
    addMenuItem(menu, "Grid", () => this.actions.layout("grid"));
    addMenuItem(menu, "Row", () => this.actions.layout("row"));
    addMenuItem(menu, "Column", () => this.actions.layout("column"));

    menu.showAtMouseEvent(event);
  }

  private showAlignMenu(event: MouseEvent): void {
    const menu = new Menu();

    addMenuItem(menu, "Align left", () => this.actions.align("left"));
    addMenuItem(menu, "Align horizontal center", () =>
      this.actions.align("center-x"),
    );
    addMenuItem(menu, "Align right", () => this.actions.align("right"));
    menu.addSeparator();
    addMenuItem(menu, "Align top", () => this.actions.align("top"));
    addMenuItem(menu, "Align vertical center", () =>
      this.actions.align("center-y"),
    );
    addMenuItem(menu, "Align bottom", () => this.actions.align("bottom"));
    menu.addSeparator();
    addMenuItem(menu, "Distribute horizontally", () =>
      this.actions.distribute("horizontal"),
    );
    addMenuItem(menu, "Distribute vertically", () =>
      this.actions.distribute("vertical"),
    );

    menu.showAtMouseEvent(event);
  }

  private showSizeMenu(event: MouseEvent): void {
    const menu = new Menu();

    addMenuItem(menu, "Small · 672 × 420", () =>
      this.actions.sizePreset("small"),
    );
    addMenuItem(menu, "Medium · 896 × 560", () =>
      this.actions.sizePreset("medium"),
    );
    addMenuItem(menu, "Large · 1120 × 700", () =>
      this.actions.sizePreset("large"),
    );
    addMenuItem(menu, "Hero · 1344 × 840", () =>
      this.actions.sizePreset("hero"),
    );
    menu.addSeparator();
    addMenuItem(menu, "Match largest", () => this.actions.matchSize("largest"));
    addMenuItem(menu, "Match smallest", () =>
      this.actions.matchSize("smallest"),
    );

    menu.showAtMouseEvent(event);
  }

  private removeButtons(menuEl: HTMLElement): void {
    for (const id of TOOLBAR_IDS) {
      menuEl.querySelector(`#${id}`)?.remove();
    }
  }
}
