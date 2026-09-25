export type Point = {
  x: number;
  y: number;
};

export type CardSize = {
  width: number;
  height: number;
};

export type CanvasLinkNodeOptions = {
  pos: Point;
  size: CardSize;
  position: "center";
  url: string;
  save: boolean;
  focus: boolean;
};

export type CanvasGroupNodeOptions = {
  pos: Point;
  size: CardSize;
  save?: boolean;
  focus?: boolean;
};

export type CanvasNodeDataLike = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
  url?: string;
  label?: string;
  [key: string]: unknown;
};

export type CanvasNodeLike = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  getData(): CanvasNodeDataLike;
  setData(data: CanvasNodeDataLike, addHistory?: boolean): void;
};

export type CanvasSelectionDataLike = {
  nodes: CanvasNodeDataLike[];
};

export type CanvasPopupMenuLike = {
  menuEl: HTMLElement;
};

export type CanvasLike = {
  wrapperEl: HTMLElement;
  readonly?: boolean;
  nodes?: Map<string, CanvasNodeLike>;
  selection?: Set<CanvasNodeLike>;
  menu?: CanvasPopupMenuLike;
  posFromEvt?(event: MouseEvent): Point;
  createLinkNode(options: CanvasLinkNodeOptions): CanvasNodeLike;
  createGroupNode?(options: CanvasGroupNodeOptions): CanvasNodeLike;
  getSelectionData?(): CanvasSelectionDataLike;
  getData?(): unknown;
  updateSelection?(update: () => void): void;
  deselectAll?(): void;
  pushHistory?(data: unknown): void;
  requestSave(immediate?: boolean): void;
};

export type CanvasViewLike = {
  getViewType(): string;
  canvas?: CanvasLike;
};
