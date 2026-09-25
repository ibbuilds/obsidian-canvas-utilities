# Canvas Utilities

Focused authoring and workflow utilities for Obsidian Canvas.

Canvas Utilities is intentionally separate from [Canvas Web Optimizer](https://github.com/ibbuilds/obsidian-canvas-web-optimizer). This plugin creates, sizes, arranges, aligns, and groups native Canvas nodes; performance, thumbnail caching, and webview lifecycle management belong in Canvas Web Optimizer.

## Features

- Paste 2+ HTTP/HTTPS URLs directly onto empty Canvas space.
- Smart-paste web cards into a deterministic moodboard with multiple 16:10 size tiers.
- Create only native Canvas link/web cards.
- Preserve Obsidian's normal single-URL paste behavior.
- Ignore paste events inside existing nodes, editors, inputs, and other editable UI.
- Import Excalidraw embeddable links as a native Canvas moodboard.
- Automatically select newly pasted cards so they can be adjusted immediately.
- Use a minimal contextual toolbar inside the native Canvas selection menu.
- Arrange selected nodes as moodboard, bento, grid, row, or column.
- Align selections left, center, right, top, middle, or bottom.
- Distribute selections horizontally or vertically.
- Resize selections to Small, Medium, Large, or Hero web-card presets.
- Match selected nodes to the largest or smallest selected size.
- Set exact horizontal or vertical gaps between selected nodes.
- Create native Canvas groups around selections.
- Keep legacy fixed-size paste commands for Compact, Desktop, and Large Desktop cards.

## Smart web-card sizes

The smart moodboard keeps a consistent 16:10 aspect ratio so it cooperates cleanly with Canvas Web Optimizer previews.

| Preset | Size |
| --- | ---: |
| Small | 672 × 420 |
| Medium | 896 × 560 |
| Large | 1120 × 700 |
| Hero | 1344 × 840 |

Medium matches Canvas Web Optimizer's current maximum thumbnail render size exactly. Larger cards keep the same aspect ratio, so cached previews can scale without letterboxing.

## Native UI

Canvas Utilities deliberately reuses Obsidian's native Canvas popup menu, native menu components, icon system, node types, groups, selection state, and history/save flow. The plugin does not introduce a separate design surface.

When two or more Canvas nodes are selected, four compact controls are added to the native selection toolbar:

- Arrange
- Align / distribute
- Resize
- Group

The detailed actions live in native Obsidian menus instead of permanently occupying Canvas space.

## Canvas Web Optimizer interoperability

Canvas Utilities does not read or modify Canvas Web Optimizer's cache or renderer internals. It communicates intent through workspace events:

- `canvas-utilities:batch-start`
- `canvas-utilities:batch-end`
- `canvas-utilities:geometry-changed`

This keeps both plugins independently usable while providing a clean integration boundary for generation pausing, reprioritization, and future thumbnail invalidation rules.

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

Bulk operations have no plugin-side node-count cap. Layout and creation paths use linear geometry passes where possible, bounded row metadata, batched mutations, and UI yielding so large selections remain responsive. The practical upper bound is still determined by Obsidian/Electron and the Canvas itself.
