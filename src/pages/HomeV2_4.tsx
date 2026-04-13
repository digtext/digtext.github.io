import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Plus, X } from "lucide-react";
import {
  EditableLine,
  EditableLineView,
  EditableLineViewHandle,
  parseToEditableLines,
} from "@/components/EditableLineView";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

const DEMO_CONTENT = `- Dig text is a new way to read and write text. You see the shortest version first, then dig deeper only where it matters to you.
    - Nesting has no limit
        - every layer is a choice the reader makes
- You can read any dig text with this reader, but hit the full-screen icon to do it without distractions.
- Paste here any bulleted list.
    - (Google Docs, Notion, Obsidian) Indented bullets are transformed into indented sections
- You can use our LLM prompt to convert any text into dig text
    - find it below
- You can also write here and use Markdown. And then copy everything as a bulleted list.
- They don't have to read everything to understand the context of what comes after.
- It has been ridiculous, guys, that since the beginning of text we've read text in the most expanded form by default
    - You may be a master at skipping text but it's a game of luck whether you missed important context
        - In practice the more you skip of a book the less likely you'll have sufficient context to enjoy finishing it
            - dig txt flips it. start from the shortest, dig into what matters`;

const PROMPT = `Summarize the following text using what I call the Quote summary approach. Use as many original fragments as possible (with quote symbols) and stitch the quotes together with your own writing to create a comprehensive and precise summary.

Produce the following summaries:

1. 1 min summary ***[note for humans: This is the most important setting in this prompt. Consider changing this number.]***
2. 3x the length of "1."
3. 6x the length of "1."

Now convert the original text into "digText" format — a progressive, collapsed-by-default reading layout. The digText syntax uses indented text:

Top-level text is always visible
  Indented text is hidden by default — the reader clicks to reveal it
    Deeper indentation = deeper levels of detail

Each level of nesting adds more detail about its parent. If a reader skips a collapsed block, the surrounding text still makes complete sense on its own.

1. Deconstruct the summaries you prepared in the 1st step into indented lines. The shortest summary stays at the top level (visible by default); all other summaries are nested as indented lines.
2. Roughly: the top level of dig-text should be the shortest summary you already prepared in the 1st step. 2nd level the 2nd longest summary. 3rd level the 3rd longest summary. And so on. Nest all of the original information (not only summaries) in indented lines. Nothing is cut — everything is preserved, just collapsed.
3. Use the progressive expansion principle. Spread indented lines evenly throughout the text.
4. After you finish, re-read only the top-level lines. They must read as a coherent, complete summary of the original on their own. If they don't, rework it until they do.

Output only the converted text in indented format (use 2-space indentation for each level). The output should be ready to paste directly into dig text.

Now transform the following text:

[paste your text here]`;

const TEXTAREA_PLACEHOLDER = `- Paste indented text or a bulleted list here
  - Tab / Shift+Tab changes indentation
  - Cmd+Shift+Up/Down moves the current item`;

const INDENT_TOKEN = "\t";
const VISUAL_INDENT_UNIT = "    ";
const TEXTAREA_HISTORY_BATCH_MS = 900;
const BULLET_WIDTH_CH = 2;

const shellClass =
  "inline-flex items-center rounded-[18px] border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900";

const pillButtonClass = (active = false) =>
  cn(
    "rounded-[16px] px-3 py-1.5 font-sans text-[14px] leading-none transition-colors",
    active
      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const getIndentWidth = (line: string) =>
  (line.match(/^[\t ]*/) ?? [""])[0].replace(/\t/g, VISUAL_INDENT_UNIT).length;

const getAdjustedSelectionEnd = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) =>
  selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
    ? selectionEnd - 1
    : selectionEnd;

const getLineStarts = (lines: string[]) => {
  const starts: number[] = [];
  let offset = 0;

  lines.forEach((line) => {
    starts.push(offset);
    offset += line.length + 1;
  });

  return starts;
};

const findLineIndexAtOffset = (lines: string[], offset: number) => {
  const starts = getLineStarts(lines);

  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (offset >= starts[index]) return index;
  }

  return 0;
};

const getSelectedLineRange = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const lines = value.split("\n");
  const adjustedEnd = getAdjustedSelectionEnd(value, selectionStart, selectionEnd);

  return {
    lines,
    startIndex: findLineIndexAtOffset(lines, selectionStart),
    endIndex: findLineIndexAtOffset(lines, adjustedEnd),
  };
};

const indentLine = (line: string) => `${INDENT_TOKEN}${line}`;

const dedentLine = (line: string) => {
  if (line.startsWith("\t")) return line.slice(1);
  if (line.startsWith(VISUAL_INDENT_UNIT)) return line.slice(VISUAL_INDENT_UNIT.length);
  if (line.startsWith("  ")) return line.slice(2);
  if (line.startsWith(" ")) return line.slice(1);
  return line;
};

const getBlockEndIndex = (lines: string[], startIndex: number) => {
  const startIndent = getIndentWidth(lines[startIndex]);
  let endIndex = startIndex + 1;

  while (endIndex < lines.length) {
    const line = lines[endIndex];

    if (!line.trim()) {
      endIndex += 1;
      continue;
    }

    if (getIndentWidth(line) > startIndent) {
      endIndex += 1;
      continue;
    }

    break;
  }

  return endIndex;
};

const getSiblingStartIndex = (
  lines: string[],
  startIndex: number,
  direction: "up" | "down",
) => {
  const startIndent = getIndentWidth(lines[startIndex]);

  if (direction === "up") {
    for (let index = startIndex - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line.trim()) continue;

      const indent = getIndentWidth(line);
      if (indent < startIndent) return null;
      if (indent === startIndent) return index;
    }
    return null;
  }

  const blockEnd = getBlockEndIndex(lines, startIndex);

  for (let index = blockEnd; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const indent = getIndentWidth(line);
    if (indent < startIndent) return null;
    if (indent === startIndent) return index;
  }

  return null;
};

const getOffsetsForLineSpan = (
  lines: string[],
  startIndex: number,
  endIndexExclusive: number,
) => {
  const starts = getLineStarts(lines);
  const start = starts[startIndex] ?? 0;

  if (endIndexExclusive >= lines.length) {
    return {
      start,
      end: lines.join("\n").length,
    };
  }

  return {
    start,
    end: (starts[endIndexExclusive] ?? 0) - 1,
  };
};

const getVisualLineData = (line: string): VisualLineData => {
  const indentMatch = line.match(/^[\t ]*/)?.[0] ?? "";
  const normalizedIndent = indentMatch.replace(/\t/g, VISUAL_INDENT_UNIT);
  const indentCh = normalizedIndent.length;
  const rest = line.slice(indentMatch.length);
  const bulletMatch = rest.match(/^([-*+•])\s+(.*)$/);

  if (bulletMatch) {
    return {
      text: `${bulletMatch[1]} ${bulletMatch[2]}`,
      paddingLeftCh: indentCh + BULLET_WIDTH_CH,
      textIndentCh: -BULLET_WIDTH_CH,
      hiddenPrefixLength: indentMatch.length,
    };
  }

  return {
    text: rest,
    paddingLeftCh: indentCh,
    textIndentCh: 0,
    hiddenPrefixLength: indentMatch.length,
  };
};

const getGcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return x || 1;
};

const inferSpaceIndentUnit = (text: string) => {
  const counts = text
    .split("\n")
    .map((line) => (line.match(/^ +/)?.[0].length ?? 0))
    .filter((count) => count > 0);

  if (counts.length === 0) return 2;

  const gcd = counts.reduce((acc, count) => getGcd(acc, count));
  if (gcd === 2 || gcd === 4) return gcd;
  if (counts.every((count) => count % 4 === 0)) return 4;
  return 2;
};

const normalizePastedListText = (text: string) => {
  const normalizedNewlines = text.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n");
  const listMarkerPattern = /^((?:[-+*•])|(?:\d+[.)])|(?:[A-Za-z][.)]))\s+/;
  const looksListLike = lines.some(
    (line) =>
      /^\s+/.test(line) ||
      listMarkerPattern.test(line.trimStart()),
  );

  if (!looksListLike) return normalizedNewlines;

  const spaceIndentUnit = inferSpaceIndentUnit(normalizedNewlines);

  return lines
    .map((line) => {
      if (!line.trim()) return "";

      const leadingWhitespace = line.match(/^[\t ]*/)?.[0] ?? "";
      const textWithoutIndent = line.slice(leadingWhitespace.length);
      const tabs = (leadingWhitespace.match(/\t/g) ?? []).length;
      const spaces = (leadingWhitespace.match(/ /g) ?? []).length;
      const indentLevel = tabs + Math.floor(spaces / spaceIndentUnit);
      const bulletMatch = textWithoutIndent.match(listMarkerPattern);
      const normalizedText = bulletMatch
        ? textWithoutIndent.slice(bulletMatch[0].length)
        : textWithoutIndent;

      if (!normalizedText.trim()) return "";

      return `${INDENT_TOKEN.repeat(indentLevel)}* ${normalizedText.trim()}`;
    })
    .join("\n");
};

const INITIAL_TEXT = normalizePastedListText(DEMO_CONTENT);

const isWordChar = (value: string) => /[A-Za-z0-9]/.test(value);

const getDiffRange = (previous: string, next: string) => {
  let start = 0;

  while (
    start < previous.length &&
    start < next.length &&
    previous[start] === next[start]
  ) {
    start += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;

  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return {
    start,
    removed: previous.slice(start, previousEnd),
    inserted: next.slice(start, nextEnd),
  };
};

interface TextAreaSelection {
  start: number;
  end: number;
}

interface TextAreaHistoryEntry {
  value: string;
  selection: TextAreaSelection;
}

interface TextAreaHistoryBatch {
  kind: "typing" | "delete";
  timestamp: number;
}

interface VisualLineData {
  text: string;
  paddingLeftCh: number;
  textIndentCh: number;
  hiddenPrefixLength: number;
}

interface HomeV2_4PageProps {
  variantLabel?: string;
  inputMode?: "editable-line" | "textarea";
}

export const HomeV2_4Page = ({
  variantLabel = "home v2.4 not text-area",
  inputMode = "editable-line",
}: HomeV2_4PageProps) => {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"digtext" | "input">("digtext");
  const [inputText, setInputText] = useState(INITIAL_TEXT);
  const [textareaSelection, setTextareaSelection] = useState<TextAreaSelection>({
    start: 0,
    end: 0,
  });
  const [lines, setLines] = useState<EditableLine[]>(() =>
    parseToEditableLines(INITIAL_TEXT),
  );
  const editorRef = useRef<EditableLineViewHandle>(null);
  const digTextRef = useRef<EditableLineViewHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaMirrorRef = useRef<HTMLDivElement>(null);
  const isTextareaSelectingRef = useRef(false);
  const pendingSelectionRef = useRef<TextAreaSelection | null>(null);
  const textAreaCurrentRef = useRef<TextAreaHistoryEntry>({
    value: INITIAL_TEXT,
    selection: { start: 0, end: 0 },
  });
  const textAreaPastRef = useRef<TextAreaHistoryEntry[]>([]);
  const textAreaFutureRef = useRef<TextAreaHistoryEntry[]>([]);
  const textAreaBatchRef = useRef<TextAreaHistoryBatch | null>(null);
  const linesRef = useRef(lines);
  const pastRef = useRef<EditableLine[][]>([]);
  const futureRef = useRef<EditableLine[][]>([]);
  const applyingHistoryRef = useRef(false);
  const [, forceUpdate] = useState(0);
  useEffect(() => { forceUpdate((n) => n + 1); }, []);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const cloneLines = useCallback(
    (value: EditableLine[]) => value.map((line) => ({ ...line })),
    [],
  );

  const areLinesEqual = useCallback((a: EditableLine[], b: EditableLine[]) => {
    if (a.length !== b.length) return false;
    return a.every((line, index) => {
      const other = b[index];
      return (
        line.id === other.id &&
        line.text === other.text &&
        line.indent === other.indent
      );
    });
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLinesChange = useCallback((newLines: EditableLine[]) => {
    if (!applyingHistoryRef.current && !areLinesEqual(linesRef.current, newLines)) {
      pastRef.current.push(cloneLines(linesRef.current));
      futureRef.current = [];
    }
    setLines(newLines);
    forceUpdate((n) => n + 1);
  }, [areLinesEqual, cloneLines]);

  const handleUndo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(cloneLines(linesRef.current));
    applyingHistoryRef.current = true;
    setLines(previous);
    forceUpdate((n) => n + 1);
    queueMicrotask(() => {
      applyingHistoryRef.current = false;
    });
  }, [cloneLines]);

  const handleRedo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneLines(linesRef.current));
    applyingHistoryRef.current = true;
    setLines(next);
    forceUpdate((n) => n + 1);
    queueMicrotask(() => {
      applyingHistoryRef.current = false;
    });
  }, [cloneLines]);

  const commitTextareaEntry = useCallback((entry: TextAreaHistoryEntry) => {
    textAreaCurrentRef.current = entry;
    setInputText(entry.value);
    setLines(parseToEditableLines(entry.value));
    pendingSelectionRef.current = entry.selection;
  }, []);

  const pushTextareaHistory = useCallback((entry: TextAreaHistoryEntry) => {
    textAreaPastRef.current.push({
      value: entry.value,
      selection: { ...entry.selection },
    });
    textAreaFutureRef.current = [];
  }, []);

  const undoTextareaHistory = useCallback(() => {
    const previous = textAreaPastRef.current.pop();
    if (!previous) return;

    textAreaFutureRef.current.push({
      value: textAreaCurrentRef.current.value,
      selection: { ...textAreaCurrentRef.current.selection },
    });
    textAreaBatchRef.current = null;
    commitTextareaEntry(previous);
  }, [commitTextareaEntry]);

  const redoTextareaHistory = useCallback(() => {
    const next = textAreaFutureRef.current.pop();
    if (!next) return;

    textAreaPastRef.current.push({
      value: textAreaCurrentRef.current.value,
      selection: { ...textAreaCurrentRef.current.selection },
    });
    textAreaBatchRef.current = null;
    commitTextareaEntry(next);
  }, [commitTextareaEntry]);

  const syncTextareaSelection = useCallback(() => {
    if (!textareaRef.current) return;
    const nextSelection = {
      start: textareaRef.current.selectionStart,
      end: textareaRef.current.selectionEnd,
    };
    setTextareaSelection(nextSelection);
    textAreaCurrentRef.current = {
      ...textAreaCurrentRef.current,
      selection: nextSelection,
    };
  }, []);

  const applyTextareaUpdate = useCallback(
    (
      nextValue: string,
      selection: TextAreaSelection,
      options?: {
        history?: "push" | "auto" | "skip";
        batchKind?: "typing" | "delete" | null;
      },
    ) => {
      const previous = textAreaCurrentRef.current;
      const historyMode = options?.history ?? "auto";
      const batchKind = options?.batchKind ?? null;

      if (historyMode === "push") {
        pushTextareaHistory(previous);
        textAreaBatchRef.current = batchKind
          ? { kind: batchKind, timestamp: Date.now() }
          : null;
      } else if (historyMode === "auto") {
        const now = Date.now();
        const batch = textAreaBatchRef.current;
        const shouldPush =
          !batch ||
          !batchKind ||
          batch.kind !== batchKind ||
          now - batch.timestamp > TEXTAREA_HISTORY_BATCH_MS;

        if (shouldPush) {
          pushTextareaHistory(previous);
        }

        textAreaBatchRef.current = batchKind
          ? { kind: batchKind, timestamp: now }
          : null;
      } else {
        textAreaBatchRef.current = null;
      }

      commitTextareaEntry({ value: nextValue, selection });
    },
    [commitTextareaEntry, pushTextareaHistory],
  );

  const handleTextareaChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      const selection = {
        start: event.target.selectionStart,
        end: event.target.selectionEnd,
      };
      const previous = textAreaCurrentRef.current.value;
      const { inserted, removed, start } = getDiffRange(previous, nextValue);
      const previousChar = previous[start - 1] ?? "";

      if (inserted && !removed) {
        const isBoundaryInsertion =
          inserted.length !== 1 ||
          inserted.includes("\n") ||
          (!isWordChar(inserted) && !/\s/.test(inserted)) ||
          (!isWordChar(previousChar) && !/\s/.test(previousChar));

        applyTextareaUpdate(nextValue, selection, {
          history: isBoundaryInsertion ? "push" : "auto",
          batchKind: "typing",
        });
        return;
      }

      if (removed && !inserted) {
        const isBoundaryDeletion =
          removed.length !== 1 || removed.includes("\n") || !isWordChar(removed);

        applyTextareaUpdate(nextValue, selection, {
          history: isBoundaryDeletion ? "push" : "auto",
          batchKind: "delete",
        });
        return;
      }

      applyTextareaUpdate(nextValue, selection, {
        history: "push",
        batchKind: null,
      });
    },
    [applyTextareaUpdate],
  );

  const handleTextareaPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData.getData("text/plain");
      if (!pastedText) return;

      const normalizedText = normalizePastedListText(pastedText);
      if (normalizedText === pastedText) return;

      event.preventDefault();
      const { value, selectionStart, selectionEnd } = event.currentTarget;
      const nextValue =
        value.slice(0, selectionStart) +
        normalizedText +
        value.slice(selectionEnd);
      const cursor = selectionStart + normalizedText.length;

      applyTextareaUpdate(
        nextValue,
        { start: cursor, end: cursor },
        {
          history: "push",
          batchKind: null,
        },
      );
    },
    [applyTextareaUpdate],
  );

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const isUndoShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "z";

      const isMacReorderShortcut =
        event.metaKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown");

      if (isUndoShortcut) {
        event.preventDefault();
        if (event.shiftKey) {
          redoTextareaHistory();
        } else {
          undoTextareaHistory();
        }
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const { value, selectionStart, selectionEnd } = event.currentTarget;
        const { lines: rawLines, startIndex, endIndex } = getSelectedLineRange(
          value,
          selectionStart,
          selectionEnd,
        );
        const nextLines = [...rawLines];
        const useWholeBlock = startIndex === endIndex && selectionStart === selectionEnd;
        const targetEndIndex = useWholeBlock
          ? getBlockEndIndex(rawLines, startIndex) - 1
          : endIndex;

        for (let index = startIndex; index <= targetEndIndex; index += 1) {
          nextLines[index] = event.shiftKey
            ? dedentLine(nextLines[index])
            : indentLine(nextLines[index]);
        }

        const selection = getOffsetsForLineSpan(
          nextLines,
          startIndex,
          targetEndIndex + 1,
        );
        applyTextareaUpdate(nextLines.join("\n"), selection, {
          history: "push",
          batchKind: null,
        });
        return;
      }

      if (!isMacReorderShortcut) return;

      event.preventDefault();
      const { value, selectionStart } = event.currentTarget;
      const rawLines = value.split("\n");
      const startIndex = findLineIndexAtOffset(rawLines, selectionStart);

      if (!rawLines[startIndex]?.trim()) return;

      const siblingStart = getSiblingStartIndex(
        rawLines,
        startIndex,
        event.key === "ArrowUp" ? "up" : "down",
      );

      if (siblingStart === null) return;

      const currentEnd = getBlockEndIndex(rawLines, startIndex);
      const siblingEnd = getBlockEndIndex(rawLines, siblingStart);
      const currentBlock = rawLines.slice(startIndex, currentEnd);
      const siblingBlock = rawLines.slice(siblingStart, siblingEnd);

      let nextLines: string[];
      let movedStartIndex: number;

      if (event.key === "ArrowUp") {
        nextLines = [
          ...rawLines.slice(0, siblingStart),
          ...currentBlock,
          ...rawLines.slice(siblingEnd, startIndex),
          ...siblingBlock,
          ...rawLines.slice(currentEnd),
        ];
        movedStartIndex = siblingStart;
      } else {
        nextLines = [
          ...rawLines.slice(0, startIndex),
          ...siblingBlock,
          ...currentBlock,
          ...rawLines.slice(siblingEnd),
        ];
        movedStartIndex = startIndex + siblingBlock.length;
      }

      const selection = getOffsetsForLineSpan(
        nextLines,
        movedStartIndex,
        movedStartIndex + currentBlock.length,
      );
      applyTextareaUpdate(nextLines.join("\n"), selection, {
        history: "push",
        batchKind: null,
      });
    },
    [applyTextareaUpdate, redoTextareaHistory, undoTextareaHistory],
  );

  useEffect(() => {
    if (!pendingSelectionRef.current) return;
    const selection = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    textareaRef.current?.setSelectionRange(selection.start, selection.end);
    textareaRef.current?.focus();
    setTextareaSelection(selection);
  }, [inputText]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement !== textareaRef.current) return;
      syncTextareaSelection();
    };

    const handleMouseMove = () => {
      if (!isTextareaSelectingRef.current) return;
      syncTextareaSelection();
    };

    const handleMouseUp = () => {
      if (!isTextareaSelectingRef.current) return;
      isTextareaSelectingRef.current = false;
      syncTextareaSelection();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [syncTextareaSelection]);

  const syncTextareaMirrorScroll = useCallback(() => {
    if (!textareaRef.current || !textareaMirrorRef.current) return;
    textareaMirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    textareaMirrorRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  const textareaMirrorLines = useMemo(() => {
    const rawLines = inputText.split("\n");
    const lineStarts = getLineStarts(rawLines);
    const selectionStart = Math.min(textareaSelection.start, textareaSelection.end);
    const selectionEnd = Math.max(textareaSelection.start, textareaSelection.end);

    return rawLines.map((line, index) => {
      const visual = getVisualLineData(line);
      const lineStart = lineStarts[index] ?? 0;
      const lineEnd = lineStart + line.length;
      const selectedStart = Math.max(selectionStart, lineStart);
      const selectedEnd = Math.min(selectionEnd, lineEnd);
      const hasSelection = selectedEnd > selectedStart;

      if (!hasSelection) {
        return {
          ...visual,
          beforeText: visual.text,
          selectedText: "",
          afterText: "",
        };
      }

      const localStart = Math.max(
        0,
        selectedStart - lineStart - visual.hiddenPrefixLength,
      );
      const localEnd = Math.max(
        0,
        selectedEnd - lineStart - visual.hiddenPrefixLength,
      );

      return {
        ...visual,
        beforeText: visual.text.slice(0, localStart),
        selectedText: visual.text.slice(localStart, localEnd),
        afterText: visual.text.slice(localEnd),
      };
    });
  }, [inputText, textareaSelection]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[600px] w-[600px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(244,63,94,0.35) 40%, rgba(139,92,246,0.3) 70%, transparent 80%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full opacity-25 blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(244,63,94,0.2) 60%, transparent 80%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-28">
          {/* Eyebrow */}
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-neutral-500 dark:text-neutral-400">
                a new interface for text
              </span>
            </div>
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300">
              {variantLabel}
            </span>
          </div>

          {/* Big headline */}
          <h1 className="font-serif leading-[1.0] tracking-tight text-[clamp(2.7rem,7.65vw,4.17rem)]">
            A new{" "}
            <span className="italic bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
              standard for text
            </span>
            .
            <br />
            Read the shortest version first.
            <br />
            Dig into what{" "}
            <span className="italic bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              interests you
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mt-8 max-w-2xl font-serif text-base md:text-[1.07rem] leading-relaxed text-neutral-600 dark:text-neutral-300">
            Dig text is a new way to read text. You see the shortest version
            first, then dig deeper only where it matters to you.
          </p>

          {/* ── Reader box ── */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/50">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 bg-white/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className={shellClass}>
                <button
                  onClick={() => setMode("digtext")}
                  className={pillButtonClass(mode === "digtext")}
                  type="button"
                >
                  Dig text
                </button>
                <button
                  onClick={() => setMode("input")}
                  className={pillButtonClass(mode === "input")}
                  type="button"
                >
                  Input
                </button>
              </div>

              {mode === "digtext" && (
                <div className="flex items-center gap-2 ml-auto">
                  {(digTextRef.current?.hasExpandables ?? false) && (
                    <div className={shellClass}>
                      <button
                        onClick={() => {
                          const h = digTextRef.current;
                          if (!h) return;
                          if (h.anyExpanded) {
                            h.collapseAll();
                          } else {
                            h.expandAll();
                          }
                        }}
                        className={cn(
                          pillButtonClass(false),
                          "inline-flex items-center gap-1.5",
                        )}
                        type="button"
                      >
                        {(digTextRef.current?.anyExpanded ?? false) ? (
                          <X size={14} strokeWidth={2.25} className="block" />
                        ) : (
                          <Plus size={14} strokeWidth={2.25} className="block" />
                        )}
                        {(digTextRef.current?.anyExpanded ?? false) ? "Collapse all" : "Expand all"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 pt-6 pb-7 md:px-10 md:pt-8 md:pb-9">
              {mode === "input" && inputMode === "editable-line" ? (
                <EditableLineView
                  ref={editorRef}
                  lines={lines}
                  onLinesChange={handleLinesChange}
                  onCollapseChange={() => forceUpdate((n) => n + 1)}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  variant="bullets"
                  emptyStateMessage="Paste indented text or a bulleted list here"
                />
              ) : mode === "input" ? (
                <div>
                  <div className="relative">
                    <div
                      ref={textareaMirrorRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent bg-transparent px-0 py-0 font-mono text-[14px] leading-[1.8] text-neutral-700 dark:text-neutral-300"
                    >
                      <div className="min-h-[320px] px-0 py-0">
                        {inputText.length > 0 ? (
                          textareaMirrorLines.map((visual, index) => {
                            return (
                              <div
                                key={`${index}-${visual.text}`}
                                className="whitespace-pre-wrap break-words"
                                style={{
                                  paddingLeft: `${visual.paddingLeftCh}ch`,
                                  textIndent: `${visual.textIndentCh}ch`,
                                  minHeight: "1.8em",
                                }}
                              >
                                {visual.selectedText ? (
                                  <>
                                    {visual.beforeText}
                                    <span className="bg-rose-200/70 dark:bg-rose-500/30">
                                      {visual.selectedText}
                                    </span>
                                    {visual.afterText}
                                  </>
                                ) : (
                                  visual.text || " "
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="min-h-[320px]" />
                        )}
                      </div>
                    </div>
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleTextareaChange}
                    onPaste={handleTextareaPaste}
                    onKeyDown={handleTextareaKeyDown}
                    onMouseDown={() => {
                      isTextareaSelectingRef.current = true;
                      syncTextareaSelection();
                    }}
                    onFocus={syncTextareaSelection}
                    onSelect={syncTextareaSelection}
                    onKeyUp={syncTextareaSelection}
                    onMouseUp={syncTextareaSelection}
                    onScroll={syncTextareaMirrorScroll}
                    spellCheck={false}
                    placeholder={TEXTAREA_PLACEHOLDER}
                    className="relative min-h-[320px] w-full resize-y bg-transparent font-mono text-[14px] leading-[1.8] text-transparent caret-neutral-900 outline-none placeholder:text-neutral-400 selection:bg-transparent dark:caret-neutral-50 dark:placeholder:text-neutral-500 dark:selection:bg-transparent"
                  />
                  </div>
                  <p className="mt-3 font-sans text-[12px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                    Shortcuts: Tab, Shift+Tab, Cmd+Shift+Up, Cmd+Shift+Down.
                  </p>
                </div>
              ) : (
                <EditableLineView
                  ref={digTextRef}
                  lines={lines}
                  onLinesChange={handleLinesChange}
                  onCollapseChange={() => forceUpdate((n) => n + 1)}
                  readOnly
                />
              )}
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => scrollTo("prompt")}
              className="font-sans text-sm text-neutral-400 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
            >
              Get the prompt ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── PROMPT ── */}
      <section
        id="prompt"
        className="border-t border-neutral-100 bg-neutral-50/50 scroll-mt-[65px] dark:border-neutral-800 dark:bg-neutral-900/40"
      >
        <div className="max-w-4xl mx-auto px-6 py-24">
          <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
            A new paradigm of using text
          </span>

          <h2 className="mt-6 font-serif text-[clamp(2rem,5vw,3.75rem)] leading-tight tracking-tight">
            Use this prompt to convert
            <br />
            any text into{" "}
            <span className="italic bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              dig text.
            </span>
          </h2>

          <p className="mt-6 mb-10 max-w-xl font-serif text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
            Paste this into your favorite LLM with any text you want converted.
            Then drop the output on the{" "}
            <Link
              to="/"
              className="underline underline-offset-2 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
            >
              dig text homepage
            </Link>{" "}
            to read it collapsed-first.
          </p>

          {/* Prompt box */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm dark:bg-neutral-900 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 font-sans text-[11px] tracking-widest uppercase text-neutral-400 dark:text-neutral-500">
                  dig text prompt
                </span>
              </div>
              <button
                onClick={handleCopy}
                aria-label="Copy prompt"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-sans text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300 transition-all dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <pre className="px-5 py-5 font-mono text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap break-words max-h-[480px] overflow-auto dark:text-neutral-300">
              {PROMPT}
            </pre>
          </div>

          <p className="mt-8 font-serif text-sm italic text-neutral-400 dark:text-neutral-500">
            Then read the text, collapsed first.
          </p>
        </div>
      </section>

      {/* ── BOTTOM HERO ── */}
      <section className="relative overflow-hidden border-t border-neutral-100 dark:border-neutral-800">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[600px] w-[600px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(244,63,94,0.35) 40%, rgba(139,92,246,0.3) 70%, transparent 80%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full opacity-25 blur-[100px]"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(244,63,94,0.2) 60%, transparent 80%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-28">
          <h1 className="font-serif leading-[1.0] tracking-tight text-[clamp(2.7rem,7.65vw,4.17rem)]">
            It is{" "}
            <em className="not-italic bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              ridiculous
            </em>
            <br />
            that we read text
            <br />
            in its{" "}
            <em className="not-italic bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
              most expanded
            </em>
            <br />
            form by default.
          </h1>

          <p className="mt-12 max-w-2xl font-serif text-xl md:text-[1.425rem] leading-snug text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-900 dark:text-neutral-50">
              Dig text
            </span>{" "}
            flips it. Text arrives{" "}
            <span className="italic text-rose-500">collapsed</span>, with most
            important things first. You{" "}
            <span className="italic text-violet-600 dark:text-violet-400">
              dig
            </span>{" "}
            only as deep as you want.
          </p>

          <div className="mt-12 flex items-center gap-3 flex-wrap">
            <Link
              to="/reader"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-sans text-sm text-white hover:bg-neutral-700 transition-colors dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Open the reader
            </Link>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 font-sans text-sm text-neutral-700 hover:border-neutral-500 hover:text-neutral-900 transition-colors dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:text-neutral-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy the prompt
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const HomeV2_4 = () => <HomeV2_4Page />;

export default HomeV2_4;
