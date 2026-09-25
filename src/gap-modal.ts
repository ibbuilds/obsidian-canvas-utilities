import { type App, Modal, Notice } from "obsidian";
import { CARD_GAP, SPACING_UNIT, snapSpacing } from "./constants";

export default class GapModal extends Modal {
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
    input.step = String(SPACING_UNIT);
    input.value = String(CARD_GAP);
    input.placeholder = "Gap · 4-point grid";
    input.style.width = "100%";

    const submit = (): void => {
      const gap = Number(input.value);

      if (!Number.isFinite(gap) || gap < 0) {
        new Notice("Gap must be a non-negative number");
        return;
      }

      this.onSubmit(snapSpacing(gap));
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
