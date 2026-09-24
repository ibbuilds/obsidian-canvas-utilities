# Canvas Utilities

Focused authoring and workflow utilities for Obsidian Canvas.

Canvas Utilities is intentionally separate from [Canvas Web Optimizer](https://github.com/ibbuilds/obsidian-canvas-web-optimizer). This plugin creates and arranges native Canvas nodes; performance, thumbnail caching, and webview lifecycle management belong in Canvas Web Optimizer.

## Features

- Paste 2+ HTTP/HTTPS URLs directly onto empty Canvas space.
- Create one native Canvas link/web card per unique URL.
- Preserve Obsidian's normal single-URL paste behavior.
- Ignore paste events inside existing nodes, editors, inputs, and other editable UI.
- Arrange bulk-pasted cards in a centered grid.
- Manual paste commands with compact, desktop, and large-desktop card sizes.
- Import Excalidraw embeddable links as native Canvas web cards.
- Match selected nodes to the largest or smallest selected size.
- Arrange selected nodes as a row, column, or grid.
- Set exact horizontal or vertical gaps between selected nodes.

## Development

Requirements:

- Node.js 22
- pnpm 12

Install dependencies:

```bash
pnpm install
```

Validate the project:

```bash
pnpm run check
```

Build the plugin:

```bash
pnpm run build
```

Watch during development:

```bash
pnpm run dev
```

Obsidian loads `main.js`, `manifest.json`, and `styles.css` from the plugin directory.

## Scope

Canvas Utilities stays focused on Canvas authoring and workflow helpers. It does not implement thumbnail generation, webview caching, virtualization, or other Canvas performance systems.
