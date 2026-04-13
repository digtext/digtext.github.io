# Dig text — Design & Interaction Preferences

---

## Quality Bar

- The editor must feel world-class — smooth and predictable, on par with Notion and Obsidian.

---

## Bullet Format (Input Mode)

- Bullets created with `- `, `* `, `+ `, or `• ` prefix followed by a space.
- Indentation (tab) determines nesting depth.



---


---

## EditableLineView — Keyboard Interactions



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

