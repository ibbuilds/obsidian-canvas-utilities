# Canvas Utilities

Focused authoring and workflow utilities for Obsidian Canvas.

Canvas Utilities is intentionally separate from [Canvas Web Optimizer](https://github.com/ibbuilds/obsidian-canvas-web-optimizer). This plugin creates, sizes, arranges, aligns, and groups native Canvas nodes; performance, thumbnail caching, and webview lifecycle management belong in Canvas Web Optimizer.

## Features

- Paste 2+ HTTP/HTTPS URLs directly onto empty Canvas space.
- Automatically build a compact adaptive bento grid instead of a loose moodboard or masonry layout.
- Use 800 × 500 as the minimum web-card tile size.
- Mix 1×1, 2×1, 1×2, 3×1, 1×3, 2×2, 3×2, and 2×3 spans on the same underlying grid.
- Prefer a slightly portrait overall composition instead of an ultra-wide strip.
- Keep every inter-card gap on a 4-point spacing system.
- Create only native Canvas link/web cards.
- Preserve Obsidian's normal single-URL paste behavior.
- Ignore paste events inside existing nodes, editors, inputs, and other editable UI.
- Import Excalidraw embeddable links into the same bento grid.
- Automatically select newly pasted cards so they can be adjusted immediately.
- Use a minimal contextual toolbar inside the native Canvas selection menu.
- Arrange selected web cards as bento, even grid, row, or column.
- Align selections left, center, right, top, middle, or bottom.
- Distribute selections horizontally or vertically.
- Resize selections to Small, Medium, Large, or Hero web-card presets.
- Match selected nodes to the largest or smallest selected size.
- Set horizontal or vertical gaps, always normalized to the 4-point spacing grid.
- Create native Canvas groups around selections.
- Keep legacy fixed-size paste commands for Compact, Desktop, and Large Desktop cards.

## Bento grid

Automatic multi-URL paste uses a deterministic adaptive bento system.

The base tile is:

```text
800 × 500
```

Every card occupies one or more integer cells on one shared lattice. The allowed spans are:

```text
1×1  small
2×1  wide
1×2  tall
3×1  panoramic accent
1×3  vertical accent
2×2  hero
3×2  wide hero
2×3  tall hero
```

The planner first chooses a global grid whose physical aspect ratio targets a slightly portrait composition rather than a horizontal strip. It then divides that grid into bounded 3×3-or-smaller macro blocks. Each macro block is tiled exactly, with no overlap and no empty cells, using a deterministic mix of the allowed spans.

Card density intentionally varies between neighboring macro blocks. This creates visual hierarchy: some regions use larger feature cards while adjacent regions use more supporting cards. The whole result still forms one continuous rectangular bento grid.

The default card gap is:

```text
64
```

Every spacing value used by Canvas Utilities is based on a 4-point unit. Custom gap input is rounded to the nearest multiple of 4 before geometry is applied.

## Manual size presets

| Preset | Size |
| --- | ---: |
| Small | 800 × 500 |
| Medium | 896 × 560 |
| Large | 1120 × 700 |
| Hero | 1344 × 840 |

Small matches the original minimum card size. Medium matches Canvas Web Optimizer's current maximum thumbnail long-edge target closely while keeping the same 16:10 ratio.

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

This keeps both plugins independently usable while providing a clean integration boundary for generation pausing and reprioritization.

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

Bulk operations have no plugin-side node-count cap. The bento planner uses bounded local exact tiling, cached 3×3-or-smaller pattern generation, dynamic programming for card allocation, batched mutations, and UI yielding so large selections remain responsive. The practical upper bound is still determined by Obsidian/Electron and the Canvas itself.
