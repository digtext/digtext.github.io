import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────

export interface EditableLine {
  id: number;
  text: string;
  indent: number; // in units (each unit = 2 spaces)
}

let _nextId = 0;
function genId() {
  return _nextId++;
}

/** Parse indented / bulleted text into a flat line array. */
export function parseToEditableLines(raw: string): EditableLine[] {
  return raw
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)(?:[-*+•]\s+)?(.*)/);
      if (!m) return null;
      const spaces = m[1].replace(/\t/g, "  ");
      const text = m[2].trim();
      if (!text) return null;
      return { id: genId(), indent: Math.floor(spaces.length / 2), text };
    })
    .filter((l): l is EditableLine => l !== null);
}

/** Convert line array back to indented string. */
export function editableLinesToString(lines: EditableLine[]): string {
  return lines.map((l) => "  ".repeat(l.indent) + l.text).join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────

function hasChildren(lines: EditableLine[], index: number): boolean {
  return index < lines.length - 1 && lines[index + 1].indent > lines[index].indent;
}

function isVisible(lines: EditableLine[], index: number, collapsed: Set<number>): boolean {
  let target = lines[index].indent;
  for (let j = index - 1; j >= 0; j--) {
    if (lines[j].indent < target) {
      if (collapsed.has(lines[j].id)) return false;
      target = lines[j].indent;
      if (target === 0) return true;
    }
  }
  return true;
}

function collectExpandableIds(lines: EditableLine[]): number[] {
  const ids: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (hasChildren(lines, i)) ids.push(lines[i].id);
  }
  return ids;
}

// ── Editable span (memo'd to avoid cursor jumps) ──────────────────────

interface EditableSpanProps {
  text: string;
  isActive: boolean;
  onInput: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onActivate: () => void;
  elRef: (el: HTMLDivElement | null) => void;
}

const EditableSpan = React.memo<EditableSpanProps>(
  ({ text, isActive, onInput, onKeyDown, onPaste, onActivate, elRef }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      elRef(ref.current);
      return () => elRef(null);
    }, [elRef]);

    // Only update DOM when text changed externally (not from typing)
    useEffect(() => {
      if (ref.current && ref.current.textContent !== text) {
        ref.current.textContent = text;
      }
    }, [text]);

    return (
      <div
        ref={ref}
        contentEditable={isActive}
        suppressContentEditableWarning
        onInput={() => onInput(ref.current?.textContent || "")}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onClick={() => {
          if (!isActive && window.getSelection()?.toString() === "") {
            onActivate();
          }
        }}
        className={cn(
          "flex-1 font-serif text-lg leading-[1.85] min-w-0 cursor-text select-text",
          isActive && "outline-none",
        )}
        style={{ wordBreak: "break-word" }}
      />
    );
  },
);
EditableSpan.displayName = "EditableSpan";

// ── Main component ────────────────────────────────────────────────────

export interface EditableLineViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
  hasExpandables: boolean;
  anyExpanded: boolean;
}

interface EditableLineViewProps {
  lines: EditableLine[];
  onLinesChange: (lines: EditableLine[]) => void;
  onCollapseChange?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  className?: string;
  emptyStateMessage?: string;
}

export const EditableLineView = React.forwardRef<
  EditableLineViewHandle,
  EditableLineViewProps
>(({ lines, onLinesChange, onCollapseChange, onUndo, onRedo, className = "", emptyStateMessage }, fwdRef) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const focusTarget = useRef<{ id: number; cursor: number } | null>(null);
  const els = useRef<Map<number, HTMLDivElement>>(new Map());

  const expandableIds = useMemo(() => collectExpandableIds(lines), [lines]);
  const hasLineContent = useMemo(
    () => lines.some((line) => line.text.trim().length > 0),
    [lines],
  );
  const showEmptyState = !hasLineContent && activeId === null;

  React.useImperativeHandle(
    fwdRef,
    () => ({
      expandAll: () => {
        setCollapsed(new Set());
        setTimeout(() => onCollapseChange?.(), 0);
      },
      collapseAll: () => {
        setCollapsed(new Set(expandableIds));
        setTimeout(() => onCollapseChange?.(), 0);
      },
      get hasExpandables() {
        return expandableIds.length > 0;
      },
      get anyExpanded() {
        return expandableIds.some((id) => !collapsed.has(id));
      },
    }),
    [expandableIds, collapsed, onCollapseChange],
  );

  // Restore focus after state changes
  useEffect(() => {
    if (!focusTarget.current) return;
    const { id, cursor } = focusTarget.current;
    focusTarget.current = null;
    const el = els.current.get(id);
    if (!el) return;
    el.focus();
    try {
      const sel = window.getSelection();
      const node = el.firstChild || el;
      const pos = Math.min(cursor, (node.textContent || "").length);
      const range = document.createRange();
      range.setStart(node, pos);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* ignore */
    }
  });

  // Stable ref for current lines (avoids stale closures)
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const getCursor = (el: HTMLDivElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    return sel.getRangeAt(0).startOffset;
  };

  const setElRef = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [],
  );

  const createInitialLine = useCallback(
    (text = "") => {
      const newId = genId();
      setAllSelected(false);
      setActiveId(newId);
      onLinesChange([{ id: newId, text, indent: 0 }]);
      focusTarget.current = { id: newId, cursor: text.length };
    },
    [onLinesChange],
  );

  const handleInput = useCallback(
    (id: number, text: string) => {
      const cur = linesRef.current;
      const idx = cur.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const next = [...cur];
      next[idx] = { ...next[idx], text };
      onLinesChange(next);
    },
    [onLinesChange],
  );

  const handleKeyDown = useCallback(
    (id: number, e: React.KeyboardEvent<HTMLDivElement>) => {
      const cur = linesRef.current;
      const idx = cur.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const line = cur[idx];
      const el = els.current.get(id);
      const cursor = el ? getCursor(el) : 0;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }

      // Cmd+A: select all lines
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setAllSelected(true);
        return;
      }

      if (allSelected && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void navigator.clipboard.writeText(editableLinesToString(cur));
        return;
      }

      if (allSelected && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        void navigator.clipboard.writeText(editableLinesToString(cur));
        createInitialLine();
        return;
      }

      if (allSelected && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        return;
      }

      // When all selected: Backspace/Delete clears everything
      if (allSelected && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        createInitialLine();
        return;
      }

      // When all selected: any printable key replaces all with that character
      if (allSelected && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAllSelected(false);
        const newId = genId();
        setActiveId(newId);
        onLinesChange([{ id: newId, text: e.key, indent: 0 }]);
        focusTarget.current = { id: newId, cursor: 1 };
        return;
      }

      // Any other key clears the selection
      if (allSelected) {
        setAllSelected(false);
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const next = [...cur];
        if (e.shiftKey) {
          if (line.indent > 0) {
            next[idx] = { ...line, indent: line.indent - 1 };
            setActiveId(id);
            onLinesChange(next);
            focusTarget.current = { id, cursor };
          }
        } else {
          const maxIndent = idx > 0 ? cur[idx - 1].indent + 1 : 0;
          if (line.indent < maxIndent) {
            next[idx] = { ...line, indent: line.indent + 1 };
            setActiveId(id);
            onLinesChange(next);
            focusTarget.current = { id, cursor };
          }
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const text = el?.textContent || "";
        const before = text.slice(0, cursor);
        const after = text.slice(cursor);
        const newId = genId();
        const next = [...cur];
        next[idx] = { ...line, text: before };
        next.splice(idx + 1, 0, { id: newId, text: after, indent: line.indent });
        setActiveId(newId);
        onLinesChange(next);
        focusTarget.current = { id: newId, cursor: 0 };
        return;
      }

      if (e.key === "Backspace" && cursor === 0) {
        if (line.indent > 0) {
          e.preventDefault();
          const next = [...cur];
          next[idx] = { ...line, indent: line.indent - 1 };
          setActiveId(id);
          onLinesChange(next);
          focusTarget.current = { id, cursor: 0 };
          return;
        }
        if (idx > 0) {
          e.preventDefault();
          const prev = cur[idx - 1];
          const next = [...cur];
          next[idx - 1] = { ...prev, text: prev.text + line.text };
          next.splice(idx, 1);
          setActiveId(prev.id);
          onLinesChange(next);
          focusTarget.current = { id: prev.id, cursor: prev.text.length };
          return;
        }
      }

      if (e.key === "ArrowUp") {
        for (let j = idx - 1; j >= 0; j--) {
          if (isVisible(cur, j, collapsed)) {
            e.preventDefault();
            setActiveId(cur[j].id);
            const target = els.current.get(cur[j].id);
            if (target) {
              target.focus();
              try {
                const sel = window.getSelection();
                const node = target.firstChild || target;
                const pos = Math.min(cursor, (node.textContent || "").length);
                const range = document.createRange();
                range.setStart(node, pos);
                range.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(range);
              } catch {
                /* ignore */
              }
            }
            return;
          }
        }
      }

      if (e.key === "ArrowDown") {
        for (let j = idx + 1; j < cur.length; j++) {
          if (isVisible(cur, j, collapsed)) {
            e.preventDefault();
            setActiveId(cur[j].id);
            const target = els.current.get(cur[j].id);
            if (target) {
              target.focus();
              try {
                const sel = window.getSelection();
                const node = target.firstChild || target;
                const pos = Math.min(cursor, (node.textContent || "").length);
                const range = document.createRange();
                range.setStart(node, pos);
                range.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(range);
              } catch {
                /* ignore */
              }
            }
            return;
          }
        }
      }
    },
    [onLinesChange, collapsed, allSelected, onUndo, onRedo, createInitialLine],
  );

  const handlePaste = useCallback(
    (id: number, e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (allSelected) {
        e.preventDefault();
        const pasted = parseToEditableLines(text);
        if (pasted.length === 0) {
          createInitialLine();
          return;
        }
        setAllSelected(false);
        setActiveId(pasted[pasted.length - 1].id);
        onLinesChange(pasted);
        const last = pasted[pasted.length - 1];
        focusTarget.current = { id: last.id, cursor: last.text.length };
        return;
      }

      if (!text.includes("\n")) return; // let browser handle single-line

      e.preventDefault();
      const cur = linesRef.current;
      const idx = cur.findIndex((l) => l.id === id);
      if (idx === -1) return;

      const el = els.current.get(id);
      const cursor = el ? getCursor(el) : 0;
      const currentText = el?.textContent || "";
      const before = currentText.slice(0, cursor);
      const after = currentText.slice(cursor);

      const pasted = parseToEditableLines(text);
      if (pasted.length === 0) return;

      // Adjust indent relative to current line
      const minPasted = Math.min(...pasted.map((l) => l.indent));
      const baseIndent = cur[idx].indent;
      const adjusted = pasted.map((l) => ({
        ...l,
        indent: l.indent - minPasted + baseIndent,
      }));

      adjusted[0].text = before + adjusted[0].text;
      adjusted[adjusted.length - 1].text += after;

      const last = adjusted[adjusted.length - 1];
      const next = [...cur];
      next.splice(idx, 1, ...adjusted);
      setActiveId(last.id);
      onLinesChange(next);

      focusTarget.current = {
        id: last.id,
        cursor: last.text.length - after.length,
      };
    },
    [onLinesChange, allSelected, createInitialLine],
  );

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Notify parent after state update
    setTimeout(() => onCollapseChange?.(), 0);
  }, [onCollapseChange]);

  return (
    <div
      className={cn("flex flex-col", className)}
      onMouseDown={() => {
        if (allSelected) setAllSelected(false);
        setActiveId(null);
      }}
    >
      {showEmptyState && (
        <div
          className="min-h-[200px] flex items-center justify-center"
          onClick={() => createInitialLine()}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") return;
            if (e.key === "Enter") {
              e.preventDefault();
              createInitialLine();
              return;
            }
            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              createInitialLine(e.key);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = parseToEditableLines(e.clipboardData.getData("text/plain"));
            if (pasted.length === 0) {
              createInitialLine();
              return;
            }
            setActiveId(pasted[pasted.length - 1].id);
            onLinesChange(pasted);
            const last = pasted[pasted.length - 1];
            focusTarget.current = { id: last.id, cursor: last.text.length };
          }}
          role="button"
          tabIndex={0}
        >
          <p className="font-serif text-lg text-neutral-400 dark:text-neutral-500">
            {emptyStateMessage ?? "Click to start typing"}
          </p>
        </div>
      )}

      {!showEmptyState && lines.map((line, i) => {
        if (!isVisible(lines, i, collapsed)) return null;
        const expandable = hasChildren(lines, i);
        const isCollapsed = collapsed.has(line.id);

        return (
          <div key={line.id} className={cn("flex items-stretch", allSelected && "bg-blue-500/15 dark:bg-blue-400/15")}>
            {/* Indent spacers with vertical lines */}
            {Array.from({ length: line.indent }).map((_, level) => (
              <span key={level} className="flex-none flex w-6">
                <span className="flex-1" />
                <span className="w-[1.5px] bg-neutral-200 dark:bg-neutral-700" />
                <span className="w-1" />
              </span>
            ))}

            {/* Chevron or spacer */}
            {expandable ? (
              <button
                onClick={() => toggleCollapse(line.id)}
                className={cn(
                  "flex-none inline-flex items-center justify-center w-5 transition-colors self-start pt-[0.55em]",
                  isCollapsed
                    ? "text-[#007AFF]"
                    : "text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300",
                )}
                type="button"
                tabIndex={-1}
              >
                <ChevronRight
                  size={14}
                  strokeWidth={2.5}
                  className={cn(
                    "block transition-transform duration-150",
                    !isCollapsed && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span className="flex-none w-5" />
            )}

            {/* Editable text */}
            <EditableSpan
              text={line.text}
              isActive={activeId === line.id}
              onInput={(t) => handleInput(line.id, t)}
              onKeyDown={(e) => handleKeyDown(line.id, e)}
              onPaste={(e) => handlePaste(line.id, e)}
              onActivate={() => {
                setActiveId(line.id);
                focusTarget.current = { id: line.id, cursor: line.text.length };
              }}
              elRef={setElRef(line.id)}
            />

            {/* Collapsed indicator */}
            {expandable && isCollapsed && (
              <span className="flex-none font-sans text-sm text-neutral-400 dark:text-neutral-500 ml-1 self-start pt-[0.55em] select-none">
                …
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

EditableLineView.displayName = "EditableLineView";
