# Dig text — Design & Interaction Preferences

---

## Quality Bar

- The editor must feel world-class — smooth and predictable, on par with Notion and Obsidian.

---

## Bullet Format (Input Mode)

- Bullets created with `- `, `* `, `+ `, or `• ` prefix followed by a space.
- Indentation (2 spaces or tab) determines nesting depth.
- Top-level bullets are always visible.
- Indented sub-bullets are hidden by default — revealed by clicking the `+` icon.
- Deeper indentation = deeper level of detail.

### Bullet icons

- Items **with children** → circular `+` button (Lucide Plus, strokeWidth 2.5).
- Items **without children** (leaf nodes) → vertical line (Reddit-style), not a dot.
- When expanded, parent shows circular `×` button (Lucide X, strokeWidth 2.5).
- The `×` icon is **not filled** — outline only, same border color as hovered `+`.

---

## Reader Controls

- Tabs: **Dig** (collapsed view) / **Input** (raw editing).
- **Expand all** / **Collapse all** button — appears only when there are expandable items.
- **Fullscreen** button (Maximize2 icon) opens the reader in a dedicated route.
- No "Expand all / Collapse all" in the original `<<>>` inline format — just inline `+` buttons.

---

## EditableLineView — Visual Design

- **One vertical line per indentation level** — never two lines for the same level.
- **Line position**: guide line sits near the right edge of each indent spacer, just before the child's chevron — between the parent text left edge and the child text left edge.
- **Collapsed chevron**: Apple Files blue (`#007AFF`). Expanded chevron: neutral gray.
- Indent step: 36px. Guide line: 1.5px wide.
- **No reset button** in the toolbar. To clear, user selects all and deletes.

---

## EditableLineView — Keyboard Interactions

### Navigation
- `Arrow Left` at start of line → move to end of previous line.
- `Arrow Right` at end of line → move to start of next line.

### Editing
- `Enter` → split line at cursor; same indent as current line.
- `Enter` on an **empty indented line** → dedent instead of creating new line (Obsidian-style).
- `Backspace` at start of line → dedent first; if already at indent 0, merge with previous line.
- `Delete` at end of line → merge with next visible line.
- Typing `- `, `* `, `+ `, or `> ` at the start of an empty line → auto-indent.

### Indentation
- `Tab` → indent right (max: previous line's indent + 1).
- `Shift+Tab` → indent left.

### Select All
- `Cmd+A` → selects all content (native cross-line selection + `allSelected` flag).
- `Backspace`/`Delete` when all selected → clear everything, show empty state.
- Typing a character when all selected → replace all content with that character.
- `Cmd+C` when all selected → copy all lines as indented text.
- `Cmd+X` when all selected → cut (copy + clear).
- `Cmd+V` when all selected → clears selection flag, allows paste to proceed naturally.

### Reordering
- `Cmd+Shift+Arrow Up` → move current line block up.
- `Cmd+Shift+Arrow Down` → move current line block down.

### Undo / Redo
- `Cmd+Z` → undo (delegated to parent via `onUndo` prop).
- `Cmd+Shift+Z` → redo (delegated to parent via `onRedo` prop).

---

## EditableLineView — Cross-Line Selection

- Mouse drag and `Shift+Arrow` must produce visible cross-line selection.
- Must work on Safari — no Chrome-only APIs.
- `Backspace`/`Delete` over cross-line selection → merge remaining text of first and last lines.
- Typing a character over cross-line selection → delete selection, insert typed character.
- `Enter` over cross-line selection → delete selection, split resulting line at cursor.
- Paste over cross-line selection → delete selection, insert pasted content at cursor.

---

## EditableLineView — Paste

- Paste strips bullet prefixes (`-`, `*`, `+`, `•`) from each line.
- Indentation normalized: smallest indent in pasted block becomes base level at insertion point.
- Single-line paste at a cross-line selection → inserts text inline.
- Multi-line paste at a cross-line selection → full structured insert, preserving indentation.
- Pasting into an empty editor fills it with the parsed content.

---

## EditableLineView — Empty State

- When empty: show placeholder ("Paste indented text or a bulleted list here").
- Clicking empty state creates a new empty line and focuses it.
- Typing a key in empty state creates first line with that character.
- Pasting into empty state fills editor with parsed content.

---

## Markup Format: `<<` / `>>`

- `<<text>>` marks an expandable inline section (nesting supported).
- Used in the DigText React component and the embed script.
- In raw HTML, must use `&lt;&lt;` / `&gt;&gt;` entities (browser parses `<` as tags).
- In JS strings and the React app, `<<` / `>>` work directly.
- **Open question**: `[[]]` is a candidate replacement for the embed use case — no HTML escaping needed, wiki-style familiar syntax.

---

## Embed Script (`public/embed.js`)

- Zero dependencies — no React, no markdown library.
- Auto-scans elements with `data-digtext` attribute on DOMContentLoaded.
- SVG icons match Lucide Plus / X (strokeWidth 2.5, size 12).
- Inherits host site fonts, colors, sizes — feels native to any site.
- Expanded state: button filled with text color; X icon strokes use detected background color for contrast.
- Expanded text highlight: `color-mix(in srgb, currentColor 8%, transparent)` — adapts light/dark automatically.
- "powered by Dig text" label at 70% of body font size, 40% opacity.
- Customizable via CSS vars: `--digtext-highlight`, `--digtext-btn-color`.
- No web component — auto-scan only.

---

## Authoring Format — Open Questions / Ideas

- `<<>>` vs `[[]]` for embed: `[[]]` safer for HTML authoring, `<<>>` stays for React app.
- Bullet indent vs inline markers: bullet format better for visual hierarchy when writing; `<<>>` better for inline prose expansions.
- Possible future authoring formats considered:
  - **Footnote-style** (11): expansion content lives separately below main text, like footnotes.
  - **Screenplay-style** (14): `+` indented blocks under visible text lines — mirrors the `+` icon the reader sees.
  - **Line-break-per-level**: indentation is purely visual for the author, stripped by parser.

---

## Pages Index (`/p`)

- Live pages marked with green "live" pill.
- Experimental pages listed without pill.
- Naming convention: "Home v2.1 (bullet)", "Home v2.2", etc.
