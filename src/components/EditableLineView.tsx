import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DigCloseIcon,
  DigPlusIcon,
  digIconButtonClass,
} from "@/components/DigIcons";
import {
  extractParenthesisExpandables,
  InlineDigMarkdown,
} from "@/components/InlineDigMarkdown";
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
  return lines.map((l) => "  ".repeat(l.indent) + "- " + l.text).join("\n");
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

const INDENT_STEP_PX = 36;
const TOGGLE_WIDTH_PX = 20;
const GUIDE_WIDTH_PX = 1.5;
const GUIDE_LINE_NUDGE_PX = 0; // gray indent bars only (+ = right)

function getTextInset(indent: number): number {
  return indent * INDENT_STEP_PX + TOGGLE_WIDTH_PX;
}

function getGuideOffset(level: number): number {
  return TOGGLE_WIDTH_PX + (level - 0.5) * INDENT_STEP_PX + GUIDE_LINE_NUDGE_PX;
}

function getChevronOffset(indent: number): number {
  return getTextInset(indent) - TOGGLE_WIDTH_PX;
}

/** Compute a new line array after moving a line block up or down. */
function computeMoveBlock(
  lines: EditableLine[],
  idx: number,
  direction: "up" | "down",
): EditableLine[] | null {
  const line = lines[idx];
  let blockEnd = idx + 1;
  while (blockEnd < lines.length && lines[blockEnd].indent > line.indent) {
    blockEnd++;
  }
  if (direction === "up") {
    if (idx === 0) return null;
    if (lines[idx - 1].indent < line.indent) return null;
    let prevStart = idx - 1;
    for (let i = idx - 1; i >= 0; i--) {
      if (lines[i].indent === line.indent) { prevStart = i; break; }
      if (lines[i].indent < line.indent) return null;
    }
    return [
      ...lines.slice(0, prevStart),
      ...lines.slice(idx, blockEnd),
      ...lines.slice(prevStart, idx),
      ...lines.slice(blockEnd),
    ];
  } else {
    if (blockEnd >= lines.length) return null;
    if (lines[blockEnd].indent !== line.indent) return null;
    let nextEnd = blockEnd + 1;
    while (nextEnd < lines.length && lines[nextEnd].indent > lines[blockEnd].indent) {
      nextEnd++;
    }
    return [
      ...lines.slice(0, idx),
      ...lines.slice(blockEnd, nextEnd),
      ...lines.slice(idx, blockEnd),
      ...lines.slice(nextEnd),
    ];
  }
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
  /** "lines" = chevrons + indent guides (default). "bullets" = dash prefix, no guides. */
  variant?: "lines" | "bullets";
  /** When true, content is not editable but collapse/expand still works. */
  readOnly?: boolean;
  /** Enables inline dig rendering inside a read-only line. */
  readOnlyInlineDigSyntax?: "parentheses";
  readOnlyTextClassName?: string;
  readOnlyTextStyle?: React.CSSProperties;
}

export const EditableLineView = React.forwardRef<
  EditableLineViewHandle,
  EditableLineViewProps
>(({ lines, onLinesChange, onCollapseChange, onUndo, onRedo, className = "", emptyStateMessage, variant = "lines", readOnly = false, readOnlyInlineDigSyntax, readOnlyTextClassName = "", readOnlyTextStyle }, fwdRef) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [expandedInlineDigIds, setExpandedInlineDigIds] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const focusTarget = useRef<{ id: number; cursor: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const els = useRef<Map<number, HTMLDivElement>>(new Map());
  const enterHandledRef = useRef(false);

  const expandableIds = useMemo(() => collectExpandableIds(lines), [lines]);
  const inlineDigEntries = useMemo(() => {
    if (!readOnly || readOnlyInlineDigSyntax !== "parentheses") {
      return new Map<number, ReturnType<typeof extractParenthesisExpandables>>();
    }

    return new Map(
      lines.map((line) => [line.id, extractParenthesisExpandables(line.text)]),
    );
  }, [lines, readOnly, readOnlyInlineDigSyntax]);
  const allInlineDigKeys = useMemo(() => {
    const ids: string[] = [];

    inlineDigEntries.forEach((entry, lineId) => {
      entry.map.forEach((_value, id) => {
        ids.push(`${lineId}:${id}`);
      });
    });

    return ids;
  }, [inlineDigEntries]);
  const allInlineDigKeySet = useMemo(
    () => new Set(allInlineDigKeys),
    [allInlineDigKeys],
  );
  const expandedInlineDigIdsByLine = useMemo(() => {
    const next = new Map<number, Set<number>>();

    expandedInlineDigIds.forEach((key) => {
      const separatorIndex = key.indexOf(":");
      if (separatorIndex === -1) return;

      const lineId = Number(key.slice(0, separatorIndex));
      const inlineId = Number(key.slice(separatorIndex + 1));
      if (!Number.isFinite(lineId) || !Number.isFinite(inlineId)) return;

      const lineExpandedIds = next.get(lineId) ?? new Set<number>();
      lineExpandedIds.add(inlineId);
      next.set(lineId, lineExpandedIds);
    });

    return next;
  }, [expandedInlineDigIds]);
  const hasLineContent = useMemo(
    () => lines.some((line) => line.text.trim().length > 0),
    [lines],
  );

  useEffect(() => {
    setExpandedInlineDigIds((prev) => {
      let changed = false;
      const next = new Set<string>();

      prev.forEach((id) => {
        if (allInlineDigKeySet.has(id)) {
          next.add(id);
          return;
        }

        changed = true;
      });

      return changed ? next : prev;
    });
  }, [allInlineDigKeySet]);

  React.useImperativeHandle(
    fwdRef,
    () => ({
      expandAll: () => {
        setCollapsed(new Set());
        setExpandedInlineDigIds(new Set(allInlineDigKeys));
        setTimeout(() => onCollapseChange?.(), 0);
      },
      collapseAll: () => {
        setCollapsed(new Set(expandableIds));
        setExpandedInlineDigIds(new Set());
        setTimeout(() => onCollapseChange?.(), 0);
      },
      get hasExpandables() {
        return expandableIds.length > 0 || allInlineDigKeys.length > 0;
      },
      get anyExpanded() {
        return (
          expandableIds.some((id) => !collapsed.has(id)) ||
          expandedInlineDigIds.size > 0
        );
      },
    }),
    [allInlineDigKeys, collapsed, expandableIds, expandedInlineDigIds, onCollapseChange],
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

      // Obsidian-style: Enter on empty line → dedent instead of creating new line
      if (!before && !after && info.line.indent > 0) {
        const cur = linesRef.current;
        const next = [...cur];
        next[info.idx] = { ...info.line, indent: info.line.indent - 1 };
        onLinesChange(next);
        focusTarget.current = { id: info.lineId, cursor: 0 };
        return;
      }

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

    // Bullet trigger: typing "- ", "* ", "+ ", "> " at start of empty line → indent
    if (/^[-*+•>] $/.test(text) && info.idx > 0) {
      const maxIndent = cur[info.idx - 1].indent + 1;
      if (cur[info.idx].indent < maxIndent) {
        const next = [...cur];
        next[info.idx] = { ...next[info.idx], text: "", indent: cur[info.idx].indent + 1 };
        onLinesChange(next);
        focusTarget.current = { id: info.lineId, cursor: 0 };
        return;
      }
    }

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
        // Fallback: if keydown didn't handle Enter (e.g. Safari quirk), split here
        if (!enterHandledRef.current) {
          splitActiveLine();
        }
        enterHandledRef.current = false;
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
            // Compute the merged line directly instead of reading stale linesRef
            const norm = normalizeSelection(crossSel);
            if (norm) {
              const cur = linesRef.current;
              const { startLineIdx, startOffset, endLineIdx, endOffset } = norm;
              const startLine = cur[startLineIdx];
              const endLine = cur[endLineIdx];
              const mergedText = startLine.text.slice(0, startOffset) + nativeEvent.data + endLine.text.slice(endOffset);
              const next = [...cur];
              next[startLineIdx] = { ...startLine, text: mergedText };
              if (endLineIdx > startLineIdx) next.splice(startLineIdx + 1, endLineIdx - startLineIdx);
              onLinesChange(next);
              focusTarget.current = { id: startLine.id, cursor: startOffset + nativeEvent.data.length };
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
    [getActiveInfo, deleteSelection, onLinesChange, splitActiveLine],
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

      // Move line block up/down
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const info = getActiveInfo();
        if (!info) return;
        const cur = linesRef.current;
        const moved = computeMoveBlock(cur, info.idx, e.key === "ArrowUp" ? "up" : "down");
        if (moved) {
          onLinesChange(moved);
          focusTarget.current = { id: info.lineId, cursor: info.cursor };
        }
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
      if (allSelected && (e.key === "Backspace" || e.key === "Delete" || e.key === "Enter")) {
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
        enterHandledRef.current = true;
        queueMicrotask(() => { enterHandledRef.current = false; });
        // Cross-line selection: delete selection, then split resulting line
        try {
          const crossSel = getCrossLineSelection();
          if (crossSel) {
            const norm = normalizeSelection(crossSel);
            if (norm) {
              const cur = linesRef.current;
              const { startLineIdx, startOffset, endLineIdx, endOffset } = norm;
              const startLine = cur[startLineIdx];
              const endLine = cur[endLineIdx];
              const before = startLine.text.slice(0, startOffset);
              const after = endLine.text.slice(endOffset);
              const newId = genId();
              const next = [...cur];
              next.splice(startLineIdx, endLineIdx - startLineIdx + 1,
                { ...startLine, text: before },
                { id: newId, text: after, indent: startLine.indent },
              );
              onLinesChange(next);
              focusTarget.current = { id: newId, cursor: 0 };
            }
            return;
          }
        } catch { /* cross-line edge case — fall through to splitActiveLine */ }
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
    [onLinesChange, allSelected, onUndo, onRedo, createInitialLine, getActiveInfo, splitActiveLine, getCrossLineSelection, normalizeSelection],
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
  const toggleInlineDig = useCallback((lineId: number, inlineId: number) => {
    const key = `${lineId}:${inlineId}`;

    setExpandedInlineDigIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Render ──

  const showPlaceholder = !readOnly && !hasLineContent && lines.length <= 1;
  const isBullets = variant === "bullets";

  // Markdown components for read-only mode: unwrap <p>, style links
  const mdComponents = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors"
        >
          {children}
        </a>
      ),
    }),
    [],
  );
  const readOnlyMarkdownClassName =
    "flex-1 min-w-0 font-serif text-lg leading-[1.85] " +
    "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-[1.55em] [&_h1]:font-semibold " +
    "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[1.35em] [&_h2]:font-semibold " +
    "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-[1.18em] [&_h3]:font-semibold " +
    "[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:font-semibold " +
    "[&_strong]:font-semibold [&_em]:italic " +
    "[&_a]:underline [&_a]:underline-offset-2 [&_a]:text-violet-600 dark:[&_a]:text-violet-400 [&_a:hover]:text-violet-800 dark:[&_a:hover]:text-violet-300 " +
    "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
    "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-500 dark:[&_blockquote]:border-neutral-800 dark:[&_blockquote]:text-neutral-400 " +
    "[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:font-mono dark:[&_code]:bg-neutral-800 " +
    "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-neutral-100 [&_pre]:p-4 dark:[&_pre]:bg-neutral-800 " +
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
    "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse " +
    "[&_th]:border [&_th]:border-neutral-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold dark:[&_th]:border-neutral-800 " +
    "[&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-neutral-800";

  return (
    <div className={cn("flex flex-col relative", className)}>
      {showPlaceholder && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex min-h-[200px] items-center justify-center">
          <p className="font-serif text-lg text-neutral-400 dark:text-neutral-500">
            {emptyStateMessage ?? "Click to start typing"}
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={cn("outline-none", showPlaceholder && "min-h-[200px]")}
        {...(!readOnly && {
          onInput: handleInput,
          onKeyDown: handleKeyDown,
          onBeforeInput: handleBeforeInput,
          onPaste: handlePaste,
          onMouseDown: () => { if (allSelected) setAllSelected(false); },
        })}
      >
          {lines.map((line, i) => {
            // In bullets mode all lines are visible; in lines mode respect collapse
            if (!isBullets && !isVisible(lines, i, collapsed)) return null;
            const expandable = !isBullets && hasChildren(lines, i);
            const isCollapsed = collapsed.has(line.id);
            const textInset = getTextInset(line.indent);
            const inlineDigEntry = inlineDigEntries.get(line.id);
            const inlineDigExpandedIds =
              expandedInlineDigIdsByLine.get(line.id) ?? new Set<number>();

            return (
              <div
                key={line.id}
                className={cn("relative", !readOnly && allSelected && "bg-blue-500/15 dark:bg-blue-400/15")}
              >
                {/* Gutter */}
                <div
                  contentEditable={false}
                  className="pointer-events-none absolute inset-y-0 left-0 z-[2] select-none"
                  style={{ width: `${textInset}px`, userSelect: "none" }}
                >
                  {isBullets ? (
                    /* Bullet marker */
                    <span
                      className="absolute top-0 inline-flex items-center justify-end pt-[0.55em] pr-[2px] font-serif text-neutral-800 dark:text-neutral-200"
                      style={{
                        left: `${getChevronOffset(line.indent)}px`,
                        width: `${TOGGLE_WIDTH_PX}px`,
                      }}
                    >
                      •
                    </span>
                  ) : (
                    <>
                      {/* Indent guide lines */}
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
                            digIconButtonClass,
                            "pointer-events-auto absolute top-[0.3em]",
                          )}
                          style={{
                            left: `${getChevronOffset(line.indent)}px`,
                            width: `${TOGGLE_WIDTH_PX}px`,
                          }}
                          type="button"
                          tabIndex={-1}
                        >
                          {isCollapsed ? <DigPlusIcon /> : <DigCloseIcon />}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="relative z-[1] flex items-start" style={{ paddingLeft: `${textInset}px` }}>
                  {readOnly ? (
                    <div
                      className={cn(
                        readOnlyMarkdownClassName,
                        readOnlyTextClassName,
                      )}
                      style={{ wordBreak: "break-word", ...readOnlyTextStyle }}
                    >
                      {readOnlyInlineDigSyntax === "parentheses" && inlineDigEntry ? (
                        <InlineDigMarkdown
                          shadow={inlineDigEntry.shadow}
                          expandablesMap={inlineDigEntry.map}
                          expandedIds={inlineDigExpandedIds}
                          toggle={(inlineId) => toggleInlineDig(line.id, inlineId)}
                          unwrapParagraphs
                          linkClassName="underline underline-offset-2 text-violet-600 transition-colors hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
                        />
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={mdComponents}
                        >
                          {line.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  ) : (
                    <LineText text={line.text} lineId={line.id} elRef={setElRef(line.id)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
});

EditableLineView.displayName = "EditableLineView";
