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

export type CanvasNodeDataLike = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

export type CanvasLike = {
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

export type CanvasViewLike = {
  getViewType(): string;
  canvas?: CanvasLike;
};
