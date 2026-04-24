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
    - blank spacer lines between consecutive pasted list items are collapsed so ChatGPT-style lists behave like Notion-style copies
    - non-list plain text is left alone

13. Normalized initial demo content.
    The textarea demo content was converted into the same tab + `* ` format so the page starts consistent with later pasted content.

14. Changed visual bullet rendering only in the mirror layer.
    Under the hood the stored/exported character remains `*`, but the mirrored display renders list bullets as a normal bullet glyph for readability. This applies only to leading list markers, not to `*` inside normal sentence text.
