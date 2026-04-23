2026-04-13

# Input Process

This note documents the textarea-focused input work done for `Home v2.4` in this thread.

1. Split the page variants.
   `Home v2.4 (simple)` was renamed conceptually to `Home v2.4 (not text-area)`, and a separate `Home v2.4 (text-area)` route/page was added so textarea experiments could happen without disturbing the original version.

2. Kept Dig view unchanged.
   The Dig tab continued to use the existing read-only `EditableLineView` path. Only the Input tab on the textarea variant was changed.

3. Replaced custom input editing with a real `<textarea>`.
   The textarea became the editable source of truth for the text-area variant, so Enter/newlines, native selection, paste, and browser undo behavior worked normally, especially in Safari.

4. Synced textarea content into Dig rendering.
   Textarea content was parsed into `lines` with `parseToEditableLines(...)` so switching between Input and Dig kept the same content.

5. Added textarea shortcuts.
   Implemented:
   - `Tab`
   - `Shift+Tab`
   - `Cmd+Shift+Up`
   - `Cmd+Shift+Down`

6. Made `Tab` work on logical blocks.
   When the cursor is on a single list item, indent/outdent operates on the whole item block, including nested children, not only one line.

7. Added explicit textarea history states.
   Custom actions were added to an app-level history stack so `Cmd+Z` and `Cmd+Shift+Z` work for indenting, moving blocks, and grouped typing/deleting behavior.

8. Improved wrapped-line visuals with a mirror layer.
   A non-interactive mirrored text layer was rendered behind the textarea to create hanging-indent visuals for wrapped bullet lines while keeping the real textarea for input, caret, and copy/export.

9. Replaced native textarea selection visuals in the mirror.
   Native selection background was hidden and selection highlighting was rendered in the mirror layer so the visible selection followed the hanging-indent layout instead of the textarea’s original geometry.

10. Made selection highlight update live.
    Selection syncing was extended so dragging selection updates the mirror continuously via selection/focus/mouse tracking, not only after selection ends.

11. Standardized textarea format to tabs plus `*` bullets.
    The textarea variant was normalized to one house format:
    - indentation token: tab
    - bullet token: `* `

12. Normalized pasted list content.
    Paste handling converts common list styles into the house format:
    - indentation by 2 spaces, 4 spaces, or tabs becomes tabs
    - list markers like `-`, `+`, `*`, numbered markers (`1.`, `1)`), and lettered markers (`a.`, `a)`) become `* `
    - non-list plain text is left alone

13. Normalized initial demo content.
    The textarea demo content was converted into the same tab + `* ` format so the page starts consistent with later pasted content.

14. Changed visual bullet rendering only in the mirror layer.
    Under the hood the stored/exported character remains `*`, but the mirrored display renders list bullets as a normal bullet glyph for readability. This applies only to leading list markers, not to `*` inside normal sentence text.

---

2026-04-23

# Caret alignment on wrapped lines

## Why this deserves its own note

The textarea + mirror architecture has a subtle but permanent gotcha: the two
layers use different geometry for wrapped rows. It has been accidentally
"fixed" more than once by removing the hanging indent, which kills the feature
from step 8 above. This section exists so that trap is visible the next time
someone touches caret/click behavior.

## The invariant

Wrap columns in the mirror and wrap columns in the textarea must match, **or**
caret placement on wrapped rows is wrong.

- The mirror draws each source line inside its own `<div>` with
  `padding-left: (indent + bullet width)ch` and `text-indent: -(bullet width)ch`.
  Wrapped visual rows start at `indent + bullet width` — the hanging indent.
- The textarea is a single block element. There is no native per-line
  text-indent, so wrapped visual rows always start at column 0.
- As a result the mirror fits fewer characters per wrapped row than the
  textarea does, and long lines break at different positions. Click physics
  follow the textarea's geometry, so a click on row 2 of a wrapped line in
  the mirror often lands on what the textarea considers row 1 (or the next
  bullet entirely).

## Things that do *not* fix it

- Removing the hanging indent from the mirror. "Fixes" caret alignment but
  silently deletes the step-8 feature. Do not do this.
- `text-indent: <x> each-line hanging` on the textarea. Only helps with a
  single flat indent amount; we need per-line-level indent, which a single
  CSS declaration can't express.
- Matching the textarea's `padding-left` to the deepest indent in the
  document. Over-indents shallow lines; still one global value.

## What we do instead

Two coordinated pieces, both in `HomeV3_1_InlineBack.tsx`:

1. **Keep the hanging indent in `getVisualLineData`.** Each mirror line div
   gets its own per-level `paddingLeftCh` / `textIndentCh`. This is the
   visual.
2. **Remap single clicks from the mirror's layout.** On `mouseUp`, when the
   interaction was a single click (no drag, `event.detail === 1`, no shift
   key), we use `caretRangeFromPoint` against the mirror (with
   `pointer-events` temporarily swapped) to find the actual line div and
   rendered character offset, then translate that to a source offset via
   `hiddenPrefixLength` and `getLineStarts`, and call `setSelectionRange`
   on the textarea. Drag selection and double/triple click fall through to
   native behavior so word/line selection still work.

`data-mirror-line={index}` on each mirror line is the anchor the remap walks
up to. If you change the mirror DOM structure, keep that attribute.

## When to reopen this

- If hanging indent ever becomes toggleable, keep the remap on when it's on
  and skip it when it's off.
- If a future change routes input through `contenteditable` instead of the
  textarea, the whole remap goes away — contenteditable can carry per-line
  indent natively.
- Drag selection across wrapped rows still uses the textarea's geometry and
  therefore can select the "wrong" range on very long wrapped lines. A full
  fix means remapping `mouseMove` as well; pending a stronger use case.

# Tab handler ground rules

Lessons from the Enter → Tab bug (empty line swallowed the next bullet) and
from the indent-validation request:

- `getBlockEndIndex` greedily includes every following line with greater
  indent than the current line. For an empty line that means the entire
  next bullet tree. So whole-block indent only runs when the caret is on a
  **non-empty** line.
- A Tab with only a caret (no selection) must leave the selection as a
  caret. Setting the selection to span the whole line makes the next
  keystroke overwrite it — that was the visible bug.
- Indent is blocked in **both** directions around the prev line's level:
  - prev is blank → block.
  - prev is shallower than current (`prevLevel < currentLevel`) → block.
    Tabbing a level-1 child under its level-0 parent would orphan it at
    level 2 with no level-1 parent above.
  - prev is more than one level deeper than current
    (`prevLevel > currentLevel + 1`) → block. This is the "we've read"
    case: a root-level line immediately after a deeply-nested wrap. Tab
    would put it at an intermediate level with no directly-above parent.
  Allowed: prev is a sibling (`prevLevel === currentLevel`) or a direct
  parent (`prevLevel === currentLevel + 1`). Shift+Tab (dedent) is always
  allowed.

If you're touching the Tab handler, re-read this block first.

---

2026-04-23

# Cmd+Shift+Up/Down block move

Moves the line under the caret, together with its whole sub-block
(children with deeper indent), through every allowed (position, indent)
slot in the document. One keystroke = one slot.

## Algorithm

For a caret on a non-blank line:

- **Up:**
  1. If we can still go deeper at this position
     (`currentLevel < prevLineLevel + 1`), just increment the whole
     block's indent by 1 — no positional move.
  2. Otherwise swap our block with the single line directly above,
     and take that line's level as our new indent. Our block lands
     where the prev line was; the prev line slides down to where our
     block started.
  3. If there is no line above: decrement indent by 1 if `> 0`,
     otherwise no-op. (This lets a line at an orphaned deep level
     climb out even when it's at the very top.)

- **Down:** symmetric.
  1. If there is a line below our block, swap with that single line
     and set our indent to `nextLineLevel + 1` — we land as the
     deepest-valid child of it.
  2. Otherwise (we're at the tail of the document), decrement indent
     by 1. No-op if already at 0.

## Two things that look off but are intentional

- **Only the single prev/next line crosses our block**, not its
  whole subtree. The other line's children stay put; they just
  re-parent through the natural outline walk after the swap. This
  is what produces the "stepwise rotation" shown in the spec image
  — Lorem moves past `L1` alone, leaving `L2` and `L3` in place.
- **Up starts by incrementing indent**, **down starts by swapping
  position.** The asymmetry is because the slot ordering within a
  position is indent-ascending as you walk upward: at the tail you
  first rotate through indents 0…max, then cross into the next
  position.

If you change this, re-derive the sequence against the spec image
(seven steps of moving `Lorem` from tail-at-L0 up to head-at-L0
across an `L1 > L2 > L3` outline) before shipping.
