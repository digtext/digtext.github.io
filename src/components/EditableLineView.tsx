import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────

export interface EditableLine {
  id: number;
  text: string;
  indent: number;
}

let _nextId = 0;
function genId() {
  return _nextId++;
}

/** Parse indented / bulleted text into a flat line array. */
export function parseToEditableLines(raw: string): EditableLine[] {
  const parsed = raw
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

  // Normalize: detect the smallest indent step and compress
  const indents = parsed.map((l) => l.indent).filter((i) => i > 0);
  if (indents.length > 0) {
    const step = Math.min(...indents);
    if (step > 1) {
      for (const line of parsed) {
        line.indent = Math.round(line.indent / step);
      }
    }
  }

  return parsed;
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

const INDENT_STEP_PX = 24;
const TOGGLE_WIDTH_PX = 20;
const GUIDE_WIDTH_PX = 1.5;

function getTextInset(indent: number): number {
  return indent * INDENT_STEP_PX + TOGGLE_WIDTH_PX;
}

function getGuideOffset(level: number): number {
  return TOGGLE_WIDTH_PX + (level - 0.5) * INDENT_STEP_PX;
}

function getChevronOffset(indent: number): number {
  return getTextInset(indent) - TOGGLE_WIDTH_PX;
}

// ── Selection helpers ────────────────────────────────────────────────

/** Get the line id from a DOM node by walking up to find [data-line-id] */
function getLineIdFromNode(node: Node | null): number | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement;
  while (el) {
    const id = el.getAttribute("data-line-id");
    if (id !== null) return Number(id);
    el = el.parentElement;
  }
  return null;
}

/** Get cursor offset within the line text element */
function getOffsetInLine(node: Node, offset: number, lineEl: HTMLElement): number {
  if (node === lineEl) {
    let textOffset = 0;
    for (let i = 0; i < offset && i < lineEl.childNodes.length; i++) {
      textOffset += (lineEl.childNodes[i].textContent || "").length;
    }
    return textOffset;
  }
  if (node.nodeType === Node.TEXT_NODE && node.parentNode === lineEl) {
    let total = 0;
    let sibling = lineEl.firstChild;
    while (sibling && sibling !== node) {
      total += (sibling.textContent || "").length;
      sibling = sibling.nextSibling;
    }
    return total + offset;
  }
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += (current.textContent || "").length;
    current = walker.nextNode();
  }
  return Math.min(offset, (lineEl.textContent || "").length);
}

// ── LineText — manages text imperatively to avoid React/contentEditable conflicts

const LineText = React.memo<{
  text: string;
  lineId: number;
  elRef: (el: HTMLDivElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
}>(({ text, lineId, elRef, className, style }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    elRef(ref.current);
    return () => elRef(null);
  }, [elRef]);

  useEffect(() => {
    if (ref.current && ref.current.textContent !== text) {
      ref.current.textContent = text;
    }
  }, [text]);

  return (
    <div
      ref={ref}
      data-line-id={lineId}
      className={cn(
        "flex-1 min-w-0 cursor-text select-text font-serif text-lg leading-[1.85] outline-none",
        className,
      )}
      style={{ wordBreak: "break-word", ...style }}
    />
  );
});
LineText.displayName = "LineText";

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
  const focusTarget = useRef<{ id: number; cursor: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const els = useRef<Map<number, HTMLDivElement>>(new Map());

  const expandableIds = useMemo(() => collectExpandableIds(lines), [lines]);
  const hasLineContent = useMemo(
    () => lines.some((line) => line.text.trim().length > 0),
    [lines],
  );
  const showEmptyState = !hasLineContent && lines.length <= 1 && !lines[0]?.text;

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

  // Restore focus/cursor after programmatic state changes
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

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  const setElRef = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [],
  );

  // ── Helpers for the active line ──

  const getActiveInfo = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.focusNode) return null;
    const lineId = getLineIdFromNode(sel.focusNode);
    if (lineId === null) return null;
    const el = els.current.get(lineId);
    if (!el) return null;
    const cur = linesRef.current;
    const idx = cur.findIndex((l) => l.id === lineId);
    if (idx === -1) return null;
    const cursor = getOffsetInLine(sel.focusNode, sel.focusOffset, el);
    return { lineId, el, idx, cursor, line: cur[idx] };
  }, []);

  const getCrossLineSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const anchorLineId = getLineIdFromNode(sel.anchorNode);
    const focusLineId = getLineIdFromNode(sel.focusNode);
    if (anchorLineId === null || focusLineId === null) return null;
    if (anchorLineId === focusLineId) return null;
    const anchorEl = els.current.get(anchorLineId);
    const focusEl = els.current.get(focusLineId);
    if (!anchorEl || !focusEl) return null;
    return {
      anchorLineId,
      anchorOffset: getOffsetInLine(sel.anchorNode!, sel.anchorOffset, anchorEl),
      focusLineId,
      focusOffset: getOffsetInLine(sel.focusNode!, sel.focusOffset, focusEl),
    };
  }, []);

  const normalizeSelection = useCallback(
    (s: { anchorLineId: number; anchorOffset: number; focusLineId: number; focusOffset: number }) => {
      const cur = linesRef.current;
      const ai = cur.findIndex((l) => l.id === s.anchorLineId);
      const fi = cur.findIndex((l) => l.id === s.focusLineId);
      if (ai === -1 || fi === -1) return null;
      if (ai < fi || (ai === fi && s.anchorOffset <= s.focusOffset)) {
        return { startLineIdx: ai, startOffset: s.anchorOffset, endLineIdx: fi, endOffset: s.focusOffset };
      }
      return { startLineIdx: fi, startOffset: s.focusOffset, endLineIdx: ai, endOffset: s.anchorOffset };
    },
    [],
  );

  const deleteSelection = useCallback(
    (crossSel: { anchorLineId: number; anchorOffset: number; focusLineId: number; focusOffset: number }) => {
      const cur = linesRef.current;
      const norm = normalizeSelection(crossSel);
      if (!norm) return null;
      const { startLineIdx, startOffset, endLineIdx, endOffset } = norm;
      const startLine = cur[startLineIdx];
      const endLine = cur[endLineIdx];
      const next = [...cur];
      next[startLineIdx] = { ...startLine, text: startLine.text.slice(0, startOffset) + endLine.text.slice(endOffset) };
      if (endLineIdx > startLineIdx) next.splice(startLineIdx + 1, endLineIdx - startLineIdx);
      onLinesChange(next);
      return { lineId: startLine.id, cursor: startOffset };
    },
    [normalizeSelection, onLinesChange],
  );

  const createInitialLine = useCallback(
    (text = "") => {
      const newId = genId();
      setAllSelected(false);
      onLinesChange([{ id: newId, text, indent: 0 }]);
      focusTarget.current = { id: newId, cursor: text.length };
    },
    [onLinesChange],
  );

  const splitActiveLine = useCallback(() => {
    try {
      const info = getActiveInfo();
      if (!info) return;

      const sel = window.getSelection();
      const currentText = linesRef.current[info.idx]?.text ?? info.el.textContent ?? "";
      let splitCursor = info.cursor;
      let nextText = currentText;

      if (sel && !sel.isCollapsed && sel.anchorNode && sel.focusNode) {
        const sameLineSelection =
          info.el.contains(sel.anchorNode) && info.el.contains(sel.focusNode);

        if (sameLineSelection) {
          const anchorOffset = getOffsetInLine(
            sel.anchorNode,
            sel.anchorOffset,
            info.el,
          );
          const focusOffset = getOffsetInLine(
            sel.focusNode,
            sel.focusOffset,
            info.el,
          );
          const start = Math.min(anchorOffset, focusOffset);
          const end = Math.max(anchorOffset, focusOffset);
          splitCursor = start;
          nextText = currentText.slice(0, start) + currentText.slice(end);
        }
      }

      const before = nextText.slice(0, splitCursor);
      const after = nextText.slice(splitCursor);
      const newId = genId();
      const cur = linesRef.current;
      const next = [...cur];
      next[info.idx] = { ...info.line, text: before };
      next.splice(info.idx + 1, 0, { id: newId, text: after, indent: info.line.indent });
      onLinesChange(next);
      focusTarget.current = { id: newId, cursor: 0 };
    } catch {
      // Keep Enter from taking down the whole editor if the browser selection is in an odd state.
    }
  }, [getActiveInfo, onLinesChange]);

  // ── Input: sync DOM text → state ──

  const handleInput = useCallback(() => {
    const info = getActiveInfo();
    if (!info) return;
    const text = info.el.textContent || "";
    const cur = linesRef.current;
    if (cur[info.idx].text === text) return;
    const next = [...cur];
    next[info.idx] = { ...next[info.idx], text };
    onLinesChange(next);
  }, [onLinesChange, getActiveInfo]);

  // ── BeforeInput: intercept structural mutations ──

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      const nativeEvent = e.nativeEvent as InputEvent;
      const inputType = nativeEvent.inputType;
      if (!inputType) return;

      if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
        e.preventDefault();
        return;
      }

      const sel = window.getSelection();
      if (!sel) return;

      // Cross-line selection: intercept ALL mutations
      if (!sel.isCollapsed) {
        const anchorId = getLineIdFromNode(sel.anchorNode);
        const focusId = getLineIdFromNode(sel.focusNode);
        if (anchorId !== null && focusId !== null && anchorId !== focusId) {
          e.preventDefault();
          const anchorEl = els.current.get(anchorId);
          const focusEl = els.current.get(focusId);
          if (!anchorEl || !focusEl) return;
          const crossSel = {
            anchorLineId: anchorId,
            anchorOffset: getOffsetInLine(sel.anchorNode!, sel.anchorOffset, anchorEl),
            focusLineId: focusId,
            focusOffset: getOffsetInLine(sel.focusNode!, sel.focusOffset, focusEl),
          };

          if (inputType.startsWith("delete")) {
            const result = deleteSelection(crossSel);
            if (result) focusTarget.current = { id: result.lineId, cursor: result.cursor };
          } else if (inputType === "insertText" && nativeEvent.data) {
            const result = deleteSelection(crossSel);
            if (result) {
              const cur = linesRef.current;
              const afterIdx = cur.findIndex((l) => l.id === result.lineId);
              if (afterIdx !== -1) {
                const theLine = cur[afterIdx];
                const newText = theLine.text.slice(0, result.cursor) + nativeEvent.data + theLine.text.slice(result.cursor);
                const next = [...cur];
                next[afterIdx] = { ...theLine, text: newText };
                onLinesChange(next);
                focusTarget.current = { id: result.lineId, cursor: result.cursor + nativeEvent.data.length };
              }
            }
          }
          return;
        }
      }

      // Backspace at start of line
      if (inputType === "deleteContentBackward" && sel.isCollapsed) {
        const info = getActiveInfo();
        if (!info) return;
        // Re-read cursor from the actual el, since getActiveInfo might be stale
        const cursor = getOffsetInLine(sel.focusNode!, sel.focusOffset, info.el);
        if (cursor === 0) {
          e.preventDefault();
          const cur = linesRef.current;
          if (info.line.indent > 0) {
            const next = [...cur];
            next[info.idx] = { ...info.line, indent: info.line.indent - 1 };
            onLinesChange(next);
            focusTarget.current = { id: info.lineId, cursor: 0 };
          } else if (info.idx > 0) {
            const prev = cur[info.idx - 1];
            const next = [...cur];
            next[info.idx - 1] = { ...prev, text: prev.text + info.line.text };
            next.splice(info.idx, 1);
            onLinesChange(next);
            focusTarget.current = { id: prev.id, cursor: prev.text.length };
          }
          return;
        }
      }

      // Delete at end of line
      if (inputType === "deleteContentForward" && sel.isCollapsed) {
        const info = getActiveInfo();
        if (!info) return;
        const cursor = getOffsetInLine(sel.focusNode!, sel.focusOffset, info.el);
        const textLen = (info.el.textContent || "").length;
        if (cursor >= textLen) {
          e.preventDefault();
          const cur = linesRef.current;
          // Find next visible line
          const collapseSet = collapsedRef.current;
          for (let j = info.idx + 1; j < cur.length; j++) {
            if (isVisible(cur, j, collapseSet)) {
              const nextLine = cur[j];
              const next = [...cur];
              next[info.idx] = { ...info.line, text: info.line.text + nextLine.text };
              next.splice(j, 1);
              onLinesChange(next);
              focusTarget.current = { id: info.lineId, cursor: textLen };
              return;
            }
          }
        }
      }
    },
    [getActiveInfo, deleteSelection, onLinesChange],
  );

  // ── KeyDown: Tab, undo/redo, select-all, copy/cut ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }

      // Cmd+A
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const container = containerRef.current;
        if (container) {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(container);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        setAllSelected(true);
        return;
      }

      const cur = linesRef.current;

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
        setAllSelected(false);
        return;
      }
      if (allSelected && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        createInitialLine();
        return;
      }
      if (allSelected && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAllSelected(false);
        const newId = genId();
        onLinesChange([{ id: newId, text: e.key, indent: 0 }]);
        focusTarget.current = { id: newId, cursor: 1 };
        return;
      }
      if (allSelected) {
        setAllSelected(false);
      }

      if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        splitActiveLine();
        return;
      }

      // Tab
      if (e.key === "Tab") {
        e.preventDefault();
        const info = getActiveInfo();
        if (!info) return;
        const next = [...cur];
        if (e.shiftKey) {
          if (info.line.indent > 0) {
            next[info.idx] = { ...info.line, indent: info.line.indent - 1 };
            onLinesChange(next);
            focusTarget.current = { id: info.lineId, cursor: info.cursor };
          }
        } else {
          const maxIndent = info.idx > 0 ? cur[info.idx - 1].indent + 1 : 0;
          if (info.line.indent < maxIndent) {
            next[info.idx] = { ...info.line, indent: info.line.indent + 1 };
            onLinesChange(next);
            focusTarget.current = { id: info.lineId, cursor: info.cursor };
          }
        }
        return;
      }
    },
    [onLinesChange, allSelected, onUndo, onRedo, createInitialLine, getActiveInfo, splitActiveLine],
  );

  // ── Paste ──

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData("text/plain");

      // Cross-line selection paste
      const crossSel = getCrossLineSelection();
      if (crossSel) {
        e.preventDefault();
        const result = deleteSelection(crossSel);
        if (!result) return;
        const cur = linesRef.current;
        const pIdx = cur.findIndex((l) => l.id === result.lineId);
        if (pIdx === -1) return;

        if (!text.includes("\n")) {
          const theLine = cur[pIdx];
          const newText = theLine.text.slice(0, result.cursor) + text + theLine.text.slice(result.cursor);
          const next = [...cur];
          next[pIdx] = { ...theLine, text: newText };
          onLinesChange(next);
          focusTarget.current = { id: result.lineId, cursor: result.cursor + text.length };
        } else {
          const pasted = parseToEditableLines(text);
          if (pasted.length === 0) return;
          const theLine = cur[pIdx];
          const before = theLine.text.slice(0, result.cursor);
          const after = theLine.text.slice(result.cursor);
          const minP = Math.min(...pasted.map((l) => l.indent));
          const adj = pasted.map((l) => ({ ...l, indent: l.indent - minP + theLine.indent }));
          adj[0].text = before + adj[0].text;
          adj[adj.length - 1].text += after;
          const last = adj[adj.length - 1];
          const next = [...cur];
          next.splice(pIdx, 1, ...adj);
          onLinesChange(next);
          focusTarget.current = { id: last.id, cursor: last.text.length - after.length };
        }
        return;
      }

      if (allSelected) {
        e.preventDefault();
        const pasted = parseToEditableLines(text);
        if (pasted.length === 0) { createInitialLine(); return; }
        setAllSelected(false);
        onLinesChange(pasted);
        const last = pasted[pasted.length - 1];
        focusTarget.current = { id: last.id, cursor: last.text.length };
        return;
      }

      if (!text.includes("\n")) return; // let browser handle single-line paste

      e.preventDefault();
      const info = getActiveInfo();
      if (!info) return;
      const cur = linesRef.current;
      const currentText = info.el.textContent || "";
      const before = currentText.slice(0, info.cursor);
      const after = currentText.slice(info.cursor);

      const pasted = parseToEditableLines(text);
      if (pasted.length === 0) return;

      const minP = Math.min(...pasted.map((l) => l.indent));
      const adj = pasted.map((l) => ({ ...l, indent: l.indent - minP + info.line.indent }));
      adj[0].text = before + adj[0].text;
      adj[adj.length - 1].text += after;
      const last = adj[adj.length - 1];
      const next = [...cur];
      next.splice(info.idx, 1, ...adj);
      onLinesChange(next);
      focusTarget.current = { id: last.id, cursor: last.text.length - after.length };
    },
    [onLinesChange, allSelected, createInitialLine, getCrossLineSelection, deleteSelection, getActiveInfo],
  );

  const toggleCollapse = useCallback(
    (id: number) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setTimeout(() => onCollapseChange?.(), 0);
    },
    [onCollapseChange],
  );

  // ── Render ──

  return (
    <div className={cn("flex flex-col", className)}>
      {showEmptyState && (
        <div
          className="min-h-[200px] flex items-center justify-center"
          onClick={() => createInitialLine()}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") return;
            if (e.key === "Enter") { e.preventDefault(); createInitialLine(); return; }
            if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); createInitialLine(e.key); }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = parseToEditableLines(e.clipboardData.getData("text/plain"));
            if (pasted.length === 0) { createInitialLine(); return; }
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

      {!showEmptyState && (
        <div
          ref={containerRef}
          contentEditable
          suppressContentEditableWarning
          className="outline-none"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBeforeInput={handleBeforeInput}
          onPaste={handlePaste}
          onMouseDown={() => { if (allSelected) setAllSelected(false); }}
        >
          {lines.map((line, i) => {
            if (!isVisible(lines, i, collapsed)) return null;
            const expandable = hasChildren(lines, i);
            const isCollapsed = collapsed.has(line.id);
            const textInset = getTextInset(line.indent);

            return (
              <div
                key={line.id}
                className={cn("relative", allSelected && "bg-blue-500/15 dark:bg-blue-400/15")}
              >
                {/* Keep the gutter out of the editable flow so Safari can select across lines natively. */}
                <div
                  contentEditable={false}
                  className="pointer-events-none absolute inset-y-0 left-0 z-[2] select-none"
                  style={{ width: `${textInset}px`, userSelect: "none" }}
                >
                  {Array.from({ length: line.indent }).map((_, level) => (
                    <span
                      key={level}
                      className="absolute inset-y-0 block bg-neutral-200 dark:bg-neutral-700"
                      style={{
                        left: `${getGuideOffset(level + 1)}px`,
                        width: `${GUIDE_WIDTH_PX}px`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  ))}

                  {expandable ? (
                    <button
                      contentEditable={false}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCollapse(line.id);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={cn(
                        "pointer-events-auto absolute top-0 inline-flex items-center justify-end pt-[0.55em] pr-[2px] transition-colors",
                        isCollapsed
                          ? "text-[#007AFF]"
                          : "text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300",
                      )}
                      style={{
                        left: `${getChevronOffset(line.indent)}px`,
                        width: `${TOGGLE_WIDTH_PX}px`,
                      }}
                      type="button"
                      tabIndex={-1}
                    >
                      <ChevronRight
                        size={12}
                        strokeWidth={2.5}
                        className={cn("block transition-transform duration-150", !isCollapsed && "rotate-90")}
                      />
                    </button>
                  ) : null}
                </div>

                <div className="relative z-[1] flex items-start" style={{ paddingLeft: `${textInset}px` }}>
                  {/* Editable text — inherits contentEditable from container */}
                  <LineText text={line.text} lineId={line.id} elRef={setElRef(line.id)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

EditableLineView.displayName = "EditableLineView";
