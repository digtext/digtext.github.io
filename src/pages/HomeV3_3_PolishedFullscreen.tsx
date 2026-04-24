import {
  Children,
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { Archive, Check, ChevronLeft, CirclePlus, Copy, Github, Mail, Maximize2, Plus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  EditableLine,
  EditableLineView,
  EditableLineViewHandle,
  parseToEditableLines,
} from "@/components/EditableLineView";
import { extractParenthesisExpandables } from "@/components/InlineDigMarkdown";
import {
  parseInlineDocument,
  getParagraphBreakCountsByLineId,
} from "@/pages/home-v3-3/previewSpacing";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

const DEMO_CONTENT = `- It has been ridiculous, guys,
    - that since writing was first invented in Mesopotamia around 3400 BCE,
        - likely in or around Uruk, probably by Sumerian record-keepers developing early accounting methods, using simple symbols pressed into wet clay tablets.
            - Look at this incredible photo from the British Museum of some of the early [clay tablets](https://www.britishmuseum.org/collection/object/W_1989-0130-4).
- we've read text in its most expanded form by default.

- Dig text flips it and by default presents the text in its most succinct form.
    - Nesting has no limit,
        - every layer is a choice the reader makes,
            - to get further involved.
- You may be a master at skipping text, but it's a game of luck whether you missed important context.
    - In practice, the more you skip of a book, the less likely you'll have sufficient context to enjoy finishing it.
        - Dig text flips it. Start from the shortest, dig into what matters.

- Write dig text in any editor, by using indented lists.
    - Paste here any bulleted list — it can be any bullet type that is \`-\`, \`*\`, or \`+\`.
        - Indented bullets from Google Docs, Notion, or Obsidian are transformed into expandable sections.
- You can write with [Markdown](https://www.markdownguide.org/basic-syntax/).
    - **Bold**, *italics*, and \`code\` all show up in the Dig preview.
- Use our AI prompt to convert any text into dig text.
    - Find it below.
- You can read any dig text with this reader — hit the full-screen icon to do it without distractions.`;

// The live composer default is loaded from /public/dig.md so site copy can be
// edited without touching the React source. Archived routes should pass a
// versioned source URL so their copy remains frozen.
const DIG_SOURCE_URL = "/dig.md";
const DIG_SOURCE_UPDATED_EVENT = "dig:source-updated";

// The prompt shown below is loaded from /public/prompt.md so it stays in sync
// with the standalone /prompt.md URL that users can hand directly to an LLM.
const PROMPT_URL = "/prompt.md";

const TEXTAREA_PLACEHOLDER = `- Paste indented text or a bulleted list here
  - Tab / Shift+Tab changes indentation
  - Cmd+Shift+Up/Down moves the current item
  - A blank line between bullets starts a new paragraph in the preview`;

const INDENT_TOKEN = "\t";
const VISUAL_INDENT_UNIT = "    ";
const TEXTAREA_HISTORY_BATCH_MS = 900;
const BULLET_WIDTH_CH = 2;
const COMPOSER_STORAGE_KEY = "digtext:home-composer:v2";

const isSamePageHashHref = (href: string | undefined): href is string => {
  if (!href || typeof window === "undefined") return false;
  if (href.startsWith("#")) return href.length > 1;
  try {
    const url = new URL(href, window.location.href);
    return (
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.hash.length > 1
    );
  } catch {
    return false;
  }
};

const scrollToHashHref = (href: string) => {
  if (typeof window === "undefined") return;
  const hash = href.includes("#") ? href.slice(href.indexOf("#") + 1) : "";
  if (!hash) return;
  const target = document.getElementById(hash);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${hash}`);
};
const PREVIEW_PARAGRAPH_BREAK_SPACING = "0.5em";
const PREVIEW_LINE_HEIGHT_EM = 1.85;

const shellClass =
  "inline-flex items-center rounded-[18px] border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900";

const pillButtonClass = (active = false) =>
  cn(
    "rounded-[16px] px-3 py-1.5 font-sans text-[14px] leading-none transition-colors",
    active
      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const iconButtonClass =
  "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[18px] border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50";

const expandAllButtonClass = (showLabel: boolean) =>
  cn(
    "inline-flex shrink-0 items-center justify-center border transition-colors",
    showLabel
      ? "h-[34px] gap-1.5 rounded-[16px] px-3"
      : "h-[34px] w-[34px] rounded-[18px]",
    "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const expandAllButtonLabelClass = "font-sans text-[14px] leading-none";

const layoutIconButtonClass = (active = false) =>
  cn(
    "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[18px] border transition-colors",
    active
      ? "border-[#BDB7EF] bg-[#EEECFF] text-[#6155F5] hover:border-[#BDB7EF] hover:bg-[#EEECFF] hover:text-[#6155F5] dark:border-[#5A5398] dark:bg-[#302A63] dark:text-[#DCD8FF] dark:hover:border-[#5A5398] dark:hover:bg-[#302A63] dark:hover:text-[#DCD8FF]"
      : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const listPreviewIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-4 w-4"
    fill="none"
    focusable="false"
    width="16"
    height="16"
  >
    <circle cx="3" cy="4" r="0.9" fill="currentColor" />
    <path
      d="M5.5 4h7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.4"
    />
    <circle cx="4.9" cy="8" r="0.9" fill="currentColor" />
    <path
      d="M7.4 8h5.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.4"
    />
    <circle cx="6.8" cy="12" r="0.9" fill="currentColor" />
    <path
      d="M9.3 12h4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.4"
    />
  </svg>
);

const ExpandAllIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="block h-4 w-4"
    fill="none"
    focusable="false"
    width="16"
    height="16"
  >
    <path d="M8 3v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M5.7 8H2.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M4.1 5.9 2.1 8l2 2.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    <path d="M10.3 8h3.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M11.9 5.9 13.9 8l-2 2.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
  </svg>
);

const CollapseAllIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="block h-4 w-4"
    fill="none"
    focusable="false"
    width="16"
    height="16"
  >
    <path d="M8 3v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M2.1 8h3.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M3.7 5.9 5.7 8l-2 2.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    <path d="M13.9 8h-3.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M12.3 5.9 10.3 8l2 2.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
  </svg>
);

const readerWindowShadowClass =
  "shadow-[0_1px_0_rgba(0,0,0,.02),0_2px_6px_-2px_rgba(0,0,0,.04),0_24px_56px_-24px_rgba(15,23,42,.18)]";

const eyebrowClass =
  "inline-flex items-center gap-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600 dark:text-neutral-300";

const eyebrowRuleClass =
  "inline-block h-px w-6 bg-neutral-300 align-middle dark:bg-neutral-700";

const shortcutKeyClass =
  "rounded border border-neutral-200 px-1.5 py-[1px] font-mono text-[12px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400";

const INLINE_DIG_TOKEN_RE = /\uE000DIG(\d+)\uE001/g;

export const shouldShowExpandAllLabel = ({
  toolbarClientWidth,
  occupiedToolbarWidth,
  currentButtonWidth,
  expandedButtonWidth,
}: {
  toolbarClientWidth: number;
  occupiedToolbarWidth: number;
  currentButtonWidth: number;
  expandedButtonWidth: number;
}) => {
  if (
    toolbarClientWidth <= 0 ||
    occupiedToolbarWidth <= 0 ||
    currentButtonWidth <= 0 ||
    expandedButtonWidth <= 0
  ) {
    return false;
  }

  const extraWidthNeeded = Math.max(0, expandedButtonWidth - currentButtonWidth);
  return toolbarClientWidth + 1 >= occupiedToolbarWidth + extraWidthNeeded;
};

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

const getIndentLevel = (line: string) =>
  Math.floor(getIndentWidth(line) / VISUAL_INDENT_UNIT.length);

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
  // The mirror draws each line inside its own <div> with a hanging-indent
  // padding so wrapped rows line up under the bullet.  See the "Caret
  // alignment" section in input-process.md for why this layout and the
  // textarea's wrapping geometry have to stay coordinated — changing one
  // without the other breaks click-to-place-caret on wrapped rows.
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
      bulletDisplay: bulletMatch[1] === "*" ? "•" : bulletMatch[1],
    };
  }

  return {
    text: rest,
    paddingLeftCh: indentCh,
    textIndentCh: 0,
    hiddenPrefixLength: indentMatch.length,
    bulletDisplay: null,
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
  const hasAnyListMarker = lines.some((line) =>
    listMarkerPattern.test(line.trimStart()),
  );

  if (!hasAnyListMarker) return normalizedNewlines;

  const spaceIndentUnit = inferSpaceIndentUnit(normalizedNewlines);

  return lines
    .map((line) => {
      if (!line.trim()) return "";

      const leadingWhitespace = line.match(/^[\t ]*/)?.[0] ?? "";
      const textWithoutIndent = line.slice(leadingWhitespace.length);
      const bulletMatch = textWithoutIndent.match(listMarkerPattern);

      if (!bulletMatch) return line;

      const tabs = (leadingWhitespace.match(/\t/g) ?? []).length;
      const spaces = (leadingWhitespace.match(/ /g) ?? []).length;
      const indentLevel = tabs + Math.floor(spaces / spaceIndentUnit);
      const normalizedText = textWithoutIndent.slice(bulletMatch[0].length);

      if (!normalizedText.trim()) return "";

      return `${INDENT_TOKEN.repeat(indentLevel)}* ${normalizedText.trim()}`;
    })
    .join("\n");
};

const INITIAL_TEXT = normalizePastedListText(DEMO_CONTENT);

type StoredComposerState = {
  inputText?: unknown;
  mode?: unknown;
  previewLayout?: unknown;
  sourceUrl?: unknown;
  sourceBacked?: unknown;
};

const getStoredComposerState = (): StoredComposerState | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredComposerState;
  } catch {
    return null;
  }
};

const getStoredComposerText = (sourceUrl = DIG_SOURCE_URL) => {
  const parsed = getStoredComposerState();
  if (!parsed) return INITIAL_TEXT;

  if (
    typeof parsed.sourceUrl === "string" &&
    parsed.sourceUrl !== sourceUrl
  ) {
    return INITIAL_TEXT;
  }

  return typeof parsed.inputText === "string" ? parsed.inputText : INITIAL_TEXT;
};

const getStoredComposerSourceBacked = (sourceUrl = DIG_SOURCE_URL) => {
  const parsed = getStoredComposerState();
  if (!parsed) return true;

  if (
    typeof parsed.sourceUrl === "string" &&
    parsed.sourceUrl === sourceUrl &&
    typeof parsed.sourceBacked === "boolean"
  ) {
    return parsed.sourceBacked;
  }

  return typeof parsed.inputText === "string"
    ? parsed.inputText === INITIAL_TEXT
    : true;
};

const getStoredComposerMode = () => {
  if (typeof window === "undefined") return "digtext";

  try {
    const stored = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!stored) return "digtext";

    const parsed = JSON.parse(stored) as { mode?: unknown };
    return parsed.mode === "input" || parsed.mode === "digtext"
      ? parsed.mode
      : "digtext";
  } catch {
    return "digtext";
  }
};

const getStoredPreviewLayout = (): PreviewLayout => {
  if (typeof window === "undefined") return "inline";

  try {
    const stored = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!stored) return "inline";

    const parsed = JSON.parse(stored) as { previewLayout?: unknown };
    return parsed.previewLayout === "list" ? "list" : "inline";
  } catch {
    return "inline";
  }
};

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
  bulletDisplay: string | null;
}

type PreviewLayout = "inline" | "list";

const getPreviewParagraphSpacing = (blankLinesBefore: number) => {
  if (blankLinesBefore <= 0) return undefined;
  if (blankLinesBefore === 1) return PREVIEW_PARAGRAPH_BREAK_SPACING;
  return `calc(${PREVIEW_PARAGRAPH_BREAK_SPACING} + ${(blankLinesBefore - 1) * PREVIEW_LINE_HEIGHT_EM}em)`;
};

const collectExpandableIds = (bullets: InlineBulletNode[]): string[] => {
  const ids: string[] = [];
  const walk = (bullet: InlineBulletNode) => {
    if (bullet.children.length > 0) ids.push(bullet.id);
    bullet.children.forEach(walk);
  };
  bullets.forEach(walk);
  return ids;
};

const getInlineDigKey = (bulletId: string, inlineId: number) =>
  `${bulletId}:inline-${inlineId}`;

const countInlineDigExpandables = (bullets: InlineBulletNode[]): number => {
  let count = 0;

  const walk = (bullet: InlineBulletNode) => {
    count += extractParenthesisExpandables(bullet.text).map.size;
    bullet.children.forEach(walk);
  };

  bullets.forEach(walk);
  return count;
};

const collectInlineDigKeys = (bullets: InlineBulletNode[]): string[] => {
  const keys: string[] = [];

  const walk = (bullet: InlineBulletNode) => {
    extractParenthesisExpandables(bullet.text).map.forEach((_value, inlineId) => {
      keys.push(getInlineDigKey(bullet.id, inlineId));
    });
    bullet.children.forEach(walk);
  };

  bullets.forEach(walk);
  return keys;
};

const countExpandableBullets = (paragraphs: InlineParagraphNode[]): number =>
  paragraphs.reduce(
    (total, paragraph) => (
      total +
      collectExpandableIds(paragraph.bullets).length +
      countInlineDigExpandables(paragraph.bullets)
    ),
    0,
  );

const READING_WPM = 200;

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

const minutesForWords = (words: number): number =>
  words === 0 ? 0 : Math.max(1, Math.round(words / READING_WPM));

const computeBulletWordStats = (
  paragraphs: InlineParagraphNode[],
  expandedSourceIndices: Set<number>,
): { total: number; visible: number } => {
  let total = 0;
  let visible = 0;
  const walk = (bullet: InlineBulletNode, ancestorsVisible: boolean) => {
    const words = countWords(bullet.text);
    total += words;
    if (ancestorsVisible) visible += words;
    const idxMatch = bullet.id.match(/^node-(\d+)$/);
    const selfIndex = idxMatch ? parseInt(idxMatch[1], 10) : -1;
    const selfExpanded = selfIndex >= 0 && expandedSourceIndices.has(selfIndex);
    bullet.children.forEach((child) =>
      walk(child, ancestorsVisible && selfExpanded),
    );
  };
  paragraphs.forEach((paragraph) =>
    paragraph.bullets.forEach((bullet) => walk(bullet, true)),
  );
  return { total, visible };
};

const linkClassName =
  "text-neutral-500 underline underline-offset-2 decoration-neutral-300 transition-colors hover:text-neutral-700 hover:decoration-neutral-400 dark:text-neutral-400 dark:decoration-neutral-600 dark:hover:text-neutral-200 dark:hover:decoration-neutral-500";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-2 mb-1 block text-[1.6em] font-semibold leading-[1.2]">
      {children}
    </span>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-2 mb-1 block text-[1.35em] font-semibold leading-[1.25]">
      {children}
    </span>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-1.5 mb-1 block text-[1.15em] font-semibold leading-[1.3]">
      {children}
    </span>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-1.5 mb-1 block text-[1.05em] font-semibold leading-[1.35]">
      {children}
    </span>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-1 mb-1 block text-[1em] font-semibold leading-[1.4]">
      {children}
    </span>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <span className="mt-1 mb-1 block text-[0.95em] font-semibold uppercase tracking-wide">
      {children}
    </span>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <span className="my-1 block border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {children}
    </span>
  ),
  hr: () => (
    <span className="my-2 block h-px bg-neutral-200 dark:bg-neutral-700" />
  ),
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => {
    const samePageHash = isSamePageHashHref(href);
    return (
      <a
        href={href}
        {...(samePageHash
          ? {
              onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                event.preventDefault();
                scrollToHashHref(href!);
              },
            }
          : { target: "_blank", rel: "noopener noreferrer" })}
        className={linkClassName}
      >
        {children}
      </a>
    );
  },
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[#ECECEC] px-1 py-[1px] font-mono text-[0.9em] text-neutral-800 dark:bg-[#212121] dark:text-neutral-200">
      {children}
    </code>
  ),
};

const inlineDigMarkdownComponents = {
  ...markdownComponents,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-current/10 px-1 py-[1px] font-mono text-[0.9em] text-current">
      {children}
    </code>
  ),
};

interface InlineTextWithDigProps {
  text: string;
  digTone?: boolean;
  bulletId: string;
  expandedInlineDigIds: Set<string>;
  hoverLockedIds: Set<string>;
  toggleInlineDig: (id: string, options?: { lockHoverUntilExit?: boolean }) => void;
  unlockHover: (id: string) => void;
}

interface InlineDigSegmentProps {
  inlineKey: string;
  innerShadow: string;
  expandedInlineDigIds: Set<string>;
  hoverLockedIds: Set<string>;
  toggleInlineDig: (id: string, options?: { lockHoverUntilExit?: boolean }) => void;
  unlockHover: (id: string) => void;
}

const InlineDigSegment = ({
  inlineKey,
  innerShadow,
  expandedInlineDigIds,
  hoverLockedIds,
  toggleInlineDig,
  unlockHover,
}: InlineDigSegmentProps) => {
  const isExpanded = expandedInlineDigIds.has(inlineKey);

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => toggleInlineDig(inlineKey, { lockHoverUntilExit: true })}
        aria-label="Expand"
        className={cn(
          softDigIconButtonClass,
          "relative -top-[0.03em] cursor-pointer",
        )}
      >
        <InlinePreviewDigPlusIcon />
      </button>
    );
  }

  const isHoverLocked = hoverLockedIds.has(inlineKey);

  return (
    <span
      className={inlineDigExpandedLineClass}
      data-hover-armed={isHoverLocked ? "false" : "true"}
    >
      <span className="inline-dig-start-wrap" style={{ whiteSpace: "nowrap" }}>
        <InlinePreviewBoundaryButton
          side="start"
          onClick={() => toggleInlineDig(inlineKey)}
          onHoverReady={() => unlockHover(inlineKey)}
        />
      </span>
      {"\u2009"}
      <span className="inline-dig-text transition-colors">
        <InlineTextWithDig
          text={innerShadow}
          digTone
          bulletId={inlineKey}
          expandedInlineDigIds={expandedInlineDigIds}
          hoverLockedIds={hoverLockedIds}
          toggleInlineDig={toggleInlineDig}
          unlockHover={unlockHover}
        />
      </span>
      <span className="inline-dig-end-wrap" style={{ whiteSpace: "nowrap" }}>
        <InlinePreviewBoundaryButton
          side="end"
          onClick={() => toggleInlineDig(inlineKey)}
          onHoverReady={() => unlockHover(inlineKey)}
        />
      </span>
    </span>
  );
};

const InlineTextWithDig = ({
  text,
  digTone = false,
  bulletId,
  expandedInlineDigIds,
  hoverLockedIds,
  toggleInlineDig,
  unlockHover,
}: InlineTextWithDigProps) => {
  const { shadow, map } = useMemo(
    () => extractParenthesisExpandables(text),
    [text],
  );

  const replaceTokens = useCallback(
    (children: React.ReactNode): React.ReactNode =>
      Children.map(children, (child, idx) => {
        if (typeof child !== "string") return child;

        const parts: React.ReactNode[] = [];
        let last = 0;
        INLINE_DIG_TOKEN_RE.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = INLINE_DIG_TOKEN_RE.exec(child)) !== null) {
          if (match.index > last) parts.push(child.slice(last, match.index));

          const inlineId = Number(match[1]);
          const expandable = map.get(inlineId);
          if (expandable) {
            parts.push(
              <InlineDigSegment
                key={`inline-dig-${bulletId}-${inlineId}-${idx}`}
                inlineKey={getInlineDigKey(bulletId, inlineId)}
                innerShadow={expandable.shadow}
                expandedInlineDigIds={expandedInlineDigIds}
                hoverLockedIds={hoverLockedIds}
                toggleInlineDig={toggleInlineDig}
                unlockHover={unlockHover}
              />,
            );
          }

          last = INLINE_DIG_TOKEN_RE.lastIndex;
        }

        if (last < child.length) parts.push(child.slice(last));
        return parts.length > 0 ? parts : child;
      }),
    [bulletId, digTone, expandedInlineDigIds, hoverLockedIds, map, toggleInlineDig, unlockHover],
  );

  const components = useMemo(
    () => ({
      ...(digTone ? inlineDigMarkdownComponents : markdownComponents),
      p: ({ children }: { children?: React.ReactNode }) => <>{replaceTokens(children)}</>,
      h1: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-2 mb-1 block text-[1.6em] font-semibold leading-[1.2]">
          {replaceTokens(children)}
        </span>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-2 mb-1 block text-[1.35em] font-semibold leading-[1.25]">
          {replaceTokens(children)}
        </span>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-1.5 mb-1 block text-[1.15em] font-semibold leading-[1.3]">
          {replaceTokens(children)}
        </span>
      ),
      h4: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-1.5 mb-1 block text-[1.05em] font-semibold leading-[1.35]">
          {replaceTokens(children)}
        </span>
      ),
      h5: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-1 mb-1 block text-[1em] font-semibold leading-[1.4]">
          {replaceTokens(children)}
        </span>
      ),
      h6: ({ children }: { children?: React.ReactNode }) => (
        <span className="mt-1 mb-1 block text-[0.95em] font-semibold uppercase tracking-wide">
          {replaceTokens(children)}
        </span>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold">{replaceTokens(children)}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => (
        <em className="italic">{replaceTokens(children)}</em>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <span className="my-1 block border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {replaceTokens(children)}
        </span>
      ),
      a: ({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) => {
        const samePageHash = isSamePageHashHref(href);
        return (
          <a
            href={href}
            {...(samePageHash
              ? {
                  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                    event.preventDefault();
                    scrollToHashHref(href!);
                  },
                }
              : { target: "_blank", rel: "noopener noreferrer" })}
            className={linkClassName}
          >
            {replaceTokens(children)}
          </a>
        );
      },
      code: ({ children }: { children?: React.ReactNode }) => (
        <code className={digTone
          ? "rounded bg-current/10 px-1 py-[1px] font-mono text-[0.9em] text-current"
          : "rounded bg-[#ECECEC] px-1 py-[1px] font-mono text-[0.9em] text-neutral-800 dark:bg-[#212121] dark:text-neutral-200"}>
          {replaceTokens(children)}
        </code>
      ),
      li: ({ children }: { children?: React.ReactNode }) => <>{replaceTokens(children)}</>,
    }),
    [digTone, replaceTokens],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {shadow}
    </ReactMarkdown>
  );
};

const softDigIconButtonClass =
  "inline-dig-expand-icon group inline-flex h-5 w-5 flex-none items-center justify-center rounded-[7px] align-middle text-[#6155F5] transition-colors hover:bg-[#EEECFF] hover:text-[#6155F5] dark:text-[#B8B0FF] dark:hover:bg-[#302A63] dark:hover:text-[#DCD8FF]";

const inlineDigExpandedLineClass =
  "inline-dig-branch inline text-inherit no-underline decoration-transparent transition-colors";

const inlinePreviewBoundaryButtonClass =
  "inline-dig-boundary group/boundary inline-flex h-5 flex-none cursor-pointer items-center justify-center align-middle text-neutral-500 no-underline decoration-transparent outline-none transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-neutral-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-neutral-300/40 dark:focus-visible:ring-offset-neutral-950";

const inlinePreviewHoverStyles = `
  @media (hover: hover) and (pointer: fine) {
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary {
      color: #404040;
    }

    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary,
    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary,
    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary,
    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary {
      color: #E5E5E5;
    }

    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary .inline-dig-boundary-default,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary .inline-dig-boundary-default,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary .inline-dig-boundary-default,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary .inline-dig-boundary-default {
      opacity: 0;
    }

    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary .inline-dig-boundary-hover,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary .inline-dig-boundary-hover,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-start-wrap > .inline-dig-boundary .inline-dig-boundary-hover,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) > .inline-dig-end-wrap > .inline-dig-boundary .inline-dig-boundary-hover {
      opacity: 1;
    }

    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) .inline-dig-text {
      color: #8A8A8A;
    }

    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) .inline-dig-text {
      color: #8A8A8A;
    }

    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) .inline-dig-text {
      color: #8F8F8F;
    }

    .dark .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) .inline-dig-text {
      color: #8F8F8F;
    }

    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-start-wrap > .inline-dig-boundary:hover) .inline-dig-expand-icon,
    .inline-dig-branch[data-hover-armed="true"]:has(> .inline-dig-end-wrap > .inline-dig-boundary:hover) .inline-dig-expand-icon {
      opacity: 0.45;
    }
  }
`;

const InlinePreviewDigPlusIcon = () => (
  <svg
    aria-hidden="true"
    className="block h-5 w-5"
    fill="none"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="6.5"
      stroke="currentColor"
      strokeOpacity="0.6"
    />
    <path
      fill="currentColor"
      d="M10.6299 13.8154C10.6299 13.9847 10.568 14.1312 10.4443 14.2549C10.3206 14.3786 10.1725 14.4404 10 14.4404C9.82422 14.4404 9.67611 14.3786 9.55566 14.2549C9.43522 14.1312 9.375 13.9847 9.375 13.8154V6.80859C9.375 6.63607 9.43522 6.48796 9.55566 6.36426C9.67611 6.24056 9.82422 6.17871 10 6.17871C10.1725 6.17871 10.3206 6.24056 10.4443 6.36426C10.568 6.48796 10.6299 6.63607 10.6299 6.80859V13.8154ZM6.49902 10.9395C6.3265 10.9395 6.17839 10.8792 6.05469 10.7588C5.93099 10.6351 5.86914 10.4854 5.86914 10.3096C5.86914 10.137 5.93099 9.98893 6.05469 9.86523C6.17839 9.74154 6.3265 9.67969 6.49902 9.67969H13.5059C13.6751 9.67969 13.8216 9.74154 13.9453 9.86523C14.069 9.98893 14.1309 10.137 14.1309 10.3096C14.1309 10.4854 14.069 10.6351 13.9453 10.7588C13.8216 10.8792 13.6751 10.9395 13.5059 10.9395H6.49902Z"
    />
  </svg>
);

const InlinePreviewDigNewlineIcon = () => (
  <svg
    aria-hidden="true"
    className="block h-5 w-5"
    fill="none"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="6.5"
      stroke="currentColor"
      strokeOpacity="0.4"
    />
    <path
      d="M10.0781 13.9072L11.4453 12.3496L12.9004 10.8896C12.9557 10.8343 13.0192 10.7904 13.0908 10.7578C13.1657 10.722 13.2471 10.7041 13.335 10.7041C13.501 10.7041 13.6393 10.7611 13.75 10.875C13.8607 10.9857 13.916 11.1289 13.916 11.3047C13.916 11.4609 13.8525 11.6042 13.7256 11.7344L10.5225 14.9375C10.3988 15.0645 10.249 15.1279 10.0732 15.1279C9.89746 15.1279 9.74772 15.0645 9.62402 14.9375L6.4209 11.7344C6.2972 11.6042 6.23535 11.4609 6.23535 11.3047C6.23535 11.1289 6.28906 10.9857 6.39648 10.875C6.50716 10.7611 6.64551 10.7041 6.81152 10.7041C6.89941 10.7041 6.98079 10.722 7.05566 10.7578C7.13053 10.7904 7.19564 10.8343 7.25098 10.8896L8.69629 12.3496L10.0781 13.9072ZM7.40723 5.82129C8.49447 5.82129 9.31152 6.06706 9.8584 6.55859C10.4085 7.04688 10.6836 7.83789 10.6836 8.93164V12.0127L10.6348 13.8682C10.6283 14.0212 10.5713 14.153 10.4639 14.2637C10.3564 14.3743 10.2279 14.4297 10.0781 14.4297C9.92188 14.4297 9.79004 14.3743 9.68262 14.2637C9.5752 14.153 9.51986 14.0212 9.5166 13.8682L9.46289 12.0127L9.46777 9.01953C9.47103 8.52474 9.39941 8.13249 9.25293 7.84277C9.10645 7.55306 8.87858 7.34473 8.56934 7.21777C8.26335 7.09082 7.86621 7.02734 7.37793 7.02734C7.24121 7.02734 7.11263 7.0306 6.99219 7.03711C6.875 7.04036 6.77083 7.04362 6.67969 7.04688C6.50065 7.04688 6.35579 6.99479 6.24512 6.89062C6.13444 6.78646 6.0791 6.64648 6.0791 6.4707C6.0791 6.34375 6.10677 6.23958 6.16211 6.1582C6.2207 6.07357 6.29232 6.00846 6.37695 5.96289C6.46484 5.91732 6.55436 5.88639 6.64551 5.87012C6.75944 5.85059 6.87826 5.83757 7.00195 5.83105C7.12891 5.82454 7.264 5.82129 7.40723 5.82129Z"
      fill="currentColor"
    />
  </svg>
);

const LinePreviewDigCloseIcon = () => (
  <svg
    aria-hidden="true"
    className="block h-5 w-5"
    fill="none"
    focusable="false"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="6.5"
      className="stroke-[#C2C1C1] transition-colors group-hover:stroke-[#A3A3A3] dark:stroke-[#66666F] dark:group-hover:stroke-[#8B8B95]"
    />
    <path
      d="M12.459 7.16406C12.5345 7.09115 12.6217 7.04297 12.7207 7.01953C12.8223 6.99349 12.9238 6.99349 13.0254 7.01953C13.127 7.04557 13.2155 7.09635 13.291 7.17188C13.3665 7.2474 13.4173 7.33594 13.4434 7.4375C13.4694 7.53906 13.4694 7.64062 13.4434 7.74219C13.4199 7.84115 13.3717 7.92839 13.2988 8.00391L8.00195 13.3008C7.93164 13.3711 7.8457 13.418 7.74414 13.4414C7.64258 13.4674 7.53971 13.4674 7.43555 13.4414C7.33398 13.418 7.24544 13.3685 7.16992 13.293C7.0944 13.2174 7.04362 13.1289 7.01758 13.0273C6.99414 12.9258 6.99414 12.8242 7.01758 12.7227C7.04362 12.6211 7.0918 12.5352 7.16211 12.4648L12.459 7.16406ZM13.2988 12.4609C13.3717 12.5339 13.4199 12.6211 13.4434 12.7227C13.4694 12.8242 13.4694 12.9258 13.4434 13.0273C13.4173 13.1289 13.3665 13.2174 13.291 13.293C13.2155 13.3685 13.127 13.418 13.0254 13.4414C12.9238 13.4674 12.8223 13.4688 12.7207 13.4453C12.6217 13.4219 12.5345 13.3724 12.459 13.2969L7.16211 8C7.0918 7.92969 7.04492 7.84375 7.02148 7.74219C6.99805 7.64062 6.99805 7.53906 7.02148 7.4375C7.04492 7.33594 7.0944 7.2474 7.16992 7.17188C7.24544 7.09375 7.33398 7.04297 7.43555 7.01953C7.53971 6.99609 7.64258 6.99609 7.74414 7.01953C7.8457 7.04297 7.93164 7.09115 8.00195 7.16406L13.2988 12.4609Z"
      className="fill-[#363636] transition-colors group-hover:fill-[#262626] dark:fill-[#E5E5E5] dark:group-hover:fill-[#F5F5F5]"
    />
  </svg>
);

const InlinePreviewDigCloseIcon = () => {
  const gradientBaseId = useId().replace(/:/g, "");
  const defaultGradientId = `${gradientBaseId}-close-start-default`;
  const hoverGradientId = `${gradientBaseId}-close-start-hover`;

  return (
    <span className="relative block h-5 w-5" aria-hidden="true">
      <svg
        className="inline-dig-boundary-default absolute inset-0 block h-5 w-5 opacity-100 transition-opacity group-hover/boundary:opacity-0"
        fill="none"
        focusable="false"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.2266 7.22021C12.3021 7.1473 12.3893 7.09912 12.4883 7.07568C12.5898 7.04964 12.6914 7.04964 12.793 7.07568C12.8945 7.10173 12.9831 7.15251 13.0586 7.22803C13.1341 7.30355 13.1849 7.39209 13.2109 7.49365C13.237 7.59521 13.237 7.69678 13.2109 7.79834C13.1875 7.8973 13.1393 7.98454 13.0664 8.06006L7.76953 13.3569C7.69922 13.4272 7.61328 13.4741 7.51172 13.4976C7.41016 13.5236 7.30729 13.5236 7.20312 13.4976C7.10156 13.4741 7.01302 13.4246 6.9375 13.3491C6.86198 13.2736 6.8112 13.1851 6.78516 13.0835C6.76172 12.9819 6.76172 12.8804 6.78516 12.7788C6.8112 12.6772 6.85938 12.5913 6.92969 12.521L12.2266 7.22021ZM13.0664 12.5171C13.1393 12.59 13.1875 12.6772 13.2109 12.7788C13.237 12.8804 13.237 12.9819 13.2109 13.0835C13.1849 13.1851 13.1341 13.2736 13.0586 13.3491C12.9831 13.4246 12.8945 13.4741 12.793 13.4976C12.6914 13.5236 12.5898 13.5249 12.4883 13.5015C12.3893 13.478 12.3021 13.4285 12.2266 13.353L6.92969 8.05615C6.85938 7.98584 6.8125 7.8999 6.78906 7.79834C6.76562 7.69678 6.76562 7.59521 6.78906 7.49365C6.8125 7.39209 6.86198 7.30355 6.9375 7.22803C7.01302 7.1499 7.10156 7.09912 7.20312 7.07568C7.30729 7.05225 7.41016 7.05225 7.51172 7.07568C7.61328 7.09912 7.69922 7.1473 7.76953 7.22021L13.0664 12.5171Z"
          fill="currentColor"
        />
        <path
          d="M7 0.5H26.5V19.5H7C3.41015 19.5 0.5 16.5899 0.5 13V7C0.5 3.41015 3.41015 0.5 7 0.5Z"
          stroke={`url(#${defaultGradientId})`}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient
            id={defaultGradientId}
            x1="0"
            y1="10"
            x2="20"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.163462" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        className="inline-dig-boundary-hover absolute inset-0 block h-5 w-5 opacity-0 transition-opacity group-hover/boundary:opacity-100"
        fill="none"
        focusable="false"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.2266 7.22021C12.3021 7.1473 12.3893 7.09912 12.4883 7.07568C12.5898 7.04964 12.6914 7.04964 12.793 7.07568C12.8945 7.10173 12.9831 7.15251 13.0586 7.22803C13.1341 7.30355 13.1849 7.39209 13.2109 7.49365C13.237 7.59521 13.237 7.69678 13.2109 7.79834C13.1875 7.8973 13.1393 7.98454 13.0664 8.06006L7.76953 13.3569C7.69922 13.4272 7.61328 13.4741 7.51172 13.4976C7.41016 13.5236 7.30729 13.5236 7.20312 13.4976C7.10156 13.4741 7.01302 13.4246 6.9375 13.3491C6.86198 13.2736 6.8112 13.1851 6.78516 13.0835C6.76172 12.9819 6.76172 12.8804 6.78516 12.7788C6.8112 12.6772 6.85938 12.5913 6.92969 12.521L12.2266 7.22021ZM13.0664 12.5171C13.1393 12.59 13.1875 12.6772 13.2109 12.7788C13.237 12.8804 13.237 12.9819 13.2109 13.0835C13.1849 13.1851 13.1341 13.2736 13.0586 13.3491C12.9831 13.4246 12.8945 13.4741 12.793 13.4976C12.6914 13.5236 12.5898 13.5249 12.4883 13.5015C12.3893 13.478 12.3021 13.4285 12.2266 13.353L6.92969 8.05615C6.85938 7.98584 6.8125 7.8999 6.78906 7.79834C6.76562 7.69678 6.76562 7.59521 6.78906 7.49365C6.8125 7.39209 6.86198 7.30355 6.9375 7.22803C7.01302 7.1499 7.10156 7.09912 7.20312 7.07568C7.30729 7.05225 7.41016 7.05225 7.51172 7.07568C7.61328 7.09912 7.69922 7.1473 7.76953 7.22021L13.0664 12.5171Z"
          fill="currentColor"
        />
        <path
          d="M7 0.5H26.5V19.5H7C3.41015 19.5 0.5 16.5899 0.5 13V7C0.5 3.41015 3.41015 0.5 7 0.5Z"
          stroke={`url(#${hoverGradientId})`}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient
            id={hoverGradientId}
            x1="0"
            y1="10"
            x2="20"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.163462" stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
};

const InlinePreviewDigEndIcon = () => {
  const gradientBaseId = useId().replace(/:/g, "");
  const defaultGradientId = `${gradientBaseId}-close-end-default`;
  const gradientId = `${gradientBaseId}-close-end-hover`;
  const defaultClipPathId = `${gradientBaseId}-close-end-default-clip`;
  const clipPathId = `${gradientBaseId}-close-end-hover-clip`;

  return (
    <span className="relative block h-5 w-[11px]" aria-hidden="true">
      <svg
        className="inline-dig-boundary-default absolute inset-0 block h-5 w-[11px] opacity-100 transition-opacity group-hover/boundary:opacity-0"
        fill="none"
        focusable="false"
        width="11"
        height="20"
      viewBox="0 0 11 20"
      xmlns="http://www.w3.org/2000/svg"
    >
        <g clipPath={`url(#${defaultClipPathId})`}>
          <path
            d="M2 0.5H-8.5V19.5H2C5.58985 19.5 8.5 16.5899 8.5 13V7C8.5 3.41015 5.58985 0.5 2 0.5Z"
            stroke={`url(#${defaultGradientId})`}
            strokeLinecap="round"
          />
        </g>
        <defs>
          <linearGradient
            id={defaultGradientId}
            x1="9"
            y1="10"
            x2="0"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.163462" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <clipPath id={defaultClipPathId}>
            <rect
              width="11"
              height="20"
              fill="white"
              transform="matrix(-1 0 0 1 11 0)"
            />
          </clipPath>
        </defs>
      </svg>
      <svg
        className="inline-dig-boundary-hover absolute inset-0 block h-5 w-[11px] opacity-0 transition-opacity group-hover/boundary:opacity-100"
        fill="none"
        focusable="false"
        width="11"
        height="20"
      viewBox="0 0 11 20"
      xmlns="http://www.w3.org/2000/svg"
    >
        <g clipPath={`url(#${clipPathId})`}>
          <path
            d="M2 0.5H-8.5V19.5H2C5.58985 19.5 8.5 16.5899 8.5 13V7C8.5 3.41015 5.58985 0.5 2 0.5Z"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
          />
        </g>
        <defs>
          <linearGradient
            id={gradientId}
            x1="9"
            y1="10"
            x2="0"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.163462" stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipPathId}>
            <rect
              width="11"
              height="20"
              fill="white"
              transform="matrix(-1 0 0 1 11 0)"
            />
          </clipPath>
        </defs>
      </svg>
    </span>
  );
};

const InlinePreviewBoundaryButton = ({
  side,
  onClick,
  onHoverReady,
}: {
  side: "start" | "end";
  onClick: () => void;
  onHoverReady: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    onMouseLeave={onHoverReady}
    aria-label={side === "start" ? "Collapse section from start" : "Collapse section from end"}
    className={cn(
      inlinePreviewBoundaryButtonClass,
      side === "start" ? "w-5" : "w-[11px]",
      side === "start" ? "relative -top-[0.10em]" : "relative -top-[0.03em]",
    )}
  >
    {side === "start" ? <InlinePreviewDigCloseIcon /> : <InlinePreviewDigEndIcon />}
  </button>
);

interface InlineBulletRenderProps {
  bullet: InlineBulletNode;
  expandedIds: Set<string>;
  expandedInlineDigIds: Set<string>;
  hoverLockedIds: Set<string>;
  toggle: (id: string, options?: { lockHoverUntilExit?: boolean }) => void;
  toggleInlineDig: (id: string) => void;
  unlockHover: (id: string) => void;
  digTone?: boolean;
}

const InlineBulletRender = ({
  bullet,
  expandedIds,
  expandedInlineDigIds,
  hoverLockedIds,
  toggle,
  toggleInlineDig,
  unlockHover,
  digTone = false,
}: InlineBulletRenderProps) => {
  const hasChildren = bullet.children.length > 0;
  const isExpanded = expandedIds.has(bullet.id);
  const isHoverLocked = hoverLockedIds.has(bullet.id);

  const expandButton = hasChildren && !isExpanded ? (
    <button
      type="button"
      onClick={() => toggle(bullet.id, { lockHoverUntilExit: true })}
      aria-label="Expand"
      className={cn(
        softDigIconButtonClass,
        "relative -top-[0.03em] cursor-pointer",
      )}
    >
      <InlinePreviewDigPlusIcon />
    </button>
  ) : null;

  return (
    <>
      <span className={digTone ? "inline-dig-text transition-colors" : undefined}>
        <InlineTextWithDig
          text={bullet.text}
          digTone={digTone}
          bulletId={bullet.id}
          expandedInlineDigIds={expandedInlineDigIds}
          hoverLockedIds={hoverLockedIds}
          toggleInlineDig={toggleInlineDig}
          unlockHover={unlockHover}
        />
      </span>
      {expandButton && <span style={{ whiteSpace: "nowrap" }}>{"\u00A0"}{expandButton}</span>}
      {isExpanded && (
        <span
          className={inlineDigExpandedLineClass}
          data-hover-armed={isHoverLocked ? "false" : "true"}
        >
          <span className="inline-dig-start-wrap" style={{ whiteSpace: "nowrap" }}>
            {"\u00A0"}
            <InlinePreviewBoundaryButton
              side="start"
              onClick={() => toggle(bullet.id)}
              onHoverReady={() => unlockHover(bullet.id)}
            />
          </span>
          {bullet.children.map((child, childIndex) => (
            <Fragment key={child.id}>
              {childIndex === 0 ? "\u2009" : " "}
              <InlineBulletRender
                bullet={child}
                expandedIds={expandedIds}
                expandedInlineDigIds={expandedInlineDigIds}
                hoverLockedIds={hoverLockedIds}
                toggle={toggle}
                toggleInlineDig={toggleInlineDig}
                unlockHover={unlockHover}
                digTone
              />
            </Fragment>
          ))}
          <span className="inline-dig-end-wrap" style={{ whiteSpace: "nowrap" }}>
            <InlinePreviewBoundaryButton
              side="end"
              onClick={() => toggle(bullet.id)}
              onHoverReady={() => unlockHover(bullet.id)}
            />
          </span>
        </span>
      )}
    </>
  );
};

export interface InlineParagraphPreviewHandle {
  expandAll: () => void;
  collapseAll: () => void;
  anyExpanded: boolean;
  getExpandedSourceIndices: () => Set<number>;
  setExpandedBySourceIndices: (indices: Set<number>) => void;
}

interface InlineParagraphPreviewProps {
  text: string;
  onExpandedChange?: () => void;
  className?: string;
  style?: CSSProperties;
}

export const InlineParagraphPreview = forwardRef<
  InlineParagraphPreviewHandle,
  InlineParagraphPreviewProps
>(({ text, onExpandedChange, className, style }, ref) => {
  const paragraphs = useMemo(
    () => parseInlineDocument(text, VISUAL_INDENT_UNIT),
    [text],
  );

  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    paragraphs.forEach((paragraph) => {
      ids.push(...collectExpandableIds(paragraph.bullets));
    });
    return ids;
  }, [paragraphs]);
  const allInlineDigIds = useMemo(() => {
    const ids: string[] = [];
    paragraphs.forEach((paragraph) => {
      ids.push(...collectInlineDigKeys(paragraph.bullets));
    });
    return ids;
  }, [paragraphs]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [expandedInlineDigIds, setExpandedInlineDigIds] = useState<Set<string>>(() => new Set());
  const [hoverLockedIds, setHoverLockedIds] = useState<Set<string>>(() => new Set());
  const expandedIdsRef = useRef(expandedIds);
  const expandedInlineDigIdsRef = useRef(expandedInlineDigIds);

  useEffect(() => {
    expandedIdsRef.current = expandedIds;
  }, [expandedIds]);

  useEffect(() => {
    expandedInlineDigIdsRef.current = expandedInlineDigIds;
  }, [expandedInlineDigIds]);

  useEffect(() => {
    setExpandedIds((prev) => {
      const valid = new Set<string>();
      const known = new Set(allExpandableIds);
      prev.forEach((id) => {
        if (known.has(id)) valid.add(id);
      });
      if (valid.size === prev.size) return prev;
      return valid;
    });
    setExpandedInlineDigIds((prev) => {
      const valid = new Set<string>();
      const known = new Set(allInlineDigIds);
      prev.forEach((id) => {
        if (known.has(id)) valid.add(id);
      });
      if (valid.size === prev.size) return prev;
      return valid;
    });
    setHoverLockedIds((prev) => {
      const valid = new Set<string>();
      const known = new Set([...allExpandableIds, ...allInlineDigIds]);
      prev.forEach((id) => {
        if (known.has(id)) valid.add(id);
      });
      if (valid.size === prev.size) return prev;
      return valid;
    });
  }, [allExpandableIds, allInlineDigIds]);

  const onExpandedChangeRef = useRef(onExpandedChange);
  useEffect(() => { onExpandedChangeRef.current = onExpandedChange; });
  useEffect(() => {
    onExpandedChangeRef.current?.();
  }, [expandedIds, expandedInlineDigIds]);

  const unlockHover = useCallback((id: string) => {
    setHoverLockedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string, options?: { lockHoverUntilExit?: boolean }) => {
    const willExpand = !expandedIdsRef.current.has(id);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    setHoverLockedIds((prev) => {
      const next = new Set(prev);
      if (!willExpand || !options?.lockHoverUntilExit) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleInlineDig = useCallback((id: string, options?: { lockHoverUntilExit?: boolean }) => {
    const willExpand = !expandedInlineDigIdsRef.current.has(id);

    setExpandedInlineDigIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    setHoverLockedIds((prev) => {
      const next = new Set(prev);
      if (!willExpand || !options?.lockHoverUntilExit) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      expandAll: () => {
        setExpandedIds(new Set(allExpandableIds));
        setExpandedInlineDigIds(new Set(allInlineDigIds));
        setHoverLockedIds(new Set());
      },
      collapseAll: () => {
        setExpandedIds(new Set());
        setExpandedInlineDigIds(new Set());
        setHoverLockedIds(new Set());
      },
      get anyExpanded() {
        return expandedIds.size > 0 || expandedInlineDigIds.size > 0;
      },
      getExpandedSourceIndices: () => {
        const indices = new Set<number>();
        expandedIds.forEach((id) => {
          const match = id.match(/^node-(\d+)$/);
          if (match) indices.add(parseInt(match[1], 10));
        });
        return indices;
      },
      setExpandedBySourceIndices: (indices: Set<number>) => {
        const newExpanded = new Set<string>();
        allExpandableIds.forEach((id) => {
          const match = id.match(/^node-(\d+)$/);
          if (match && indices.has(parseInt(match[1], 10))) {
            newExpanded.add(id);
          }
        });
        setExpandedIds(newExpanded);
        setExpandedInlineDigIds(new Set());
        setHoverLockedIds(new Set());
      },
    }),
    [allExpandableIds, allInlineDigIds, expandedIds, expandedInlineDigIds],
  );

  if (paragraphs.length === 0) {
    return (
      <div className={cn("text-neutral-400 dark:text-neutral-500", className)} style={style}>
        Start typing on the Input tab to see your preview here.
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <style>{inlinePreviewHoverStyles}</style>
      {paragraphs.map((paragraph, pIdx) => (
        <div
          key={paragraph.id}
          style={
            pIdx === 0
              ? undefined
              : { marginTop: getPreviewParagraphSpacing(paragraph.blankLinesBefore) }
          }
        >
          {paragraph.bullets.map((bullet, bIdx) => (
            <Fragment key={bullet.id}>
              {bIdx > 0 ? " " : ""}
              <InlineBulletRender
                bullet={bullet}
                expandedIds={expandedIds}
                expandedInlineDigIds={expandedInlineDigIds}
                hoverLockedIds={hoverLockedIds}
                toggle={toggle}
                toggleInlineDig={toggleInlineDig}
                unlockHover={unlockHover}
              />
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
});

InlineParagraphPreview.displayName = "InlineParagraphPreview";

interface HomeV2_4PageProps {
  inputMode?: "editable-line" | "textarea";
  digSourceUrl?: string;
  heroFontClassName?: string;
  heroHeadingClassName?: string;
  heroHeadingStyle?: CSSProperties;
  topHeroHeadingClassName?: string;
  topHeroHeadingStyle?: CSSProperties;
  // Article mode — reuses the same composer/reader UI but without the home
  // marketing chrome. When on, hides hero/prompt/embed/footer, skips
  // localStorage persistence, shows a back link, and seeds the composer from
  // `articleInitialText`.
  articleMode?: boolean;
  articleInitialText?: string;
  articleBackTo?: string;
  articleBackLabel?: string;
}

export const HomeV2_4Page = ({
  inputMode = "editable-line",
  digSourceUrl = DIG_SOURCE_URL,
  heroFontClassName = "font-serif",
  heroHeadingClassName = "tracking-[-0.05em] text-[clamp(2.05rem,5.75vw,3.24rem)]",
  heroHeadingStyle = { lineHeight: 1 },
  topHeroHeadingClassName = "mt-3 tracking-tight text-[clamp(2.4rem,6.2vw,3.6rem)] leading-[1.02]",
  topHeroHeadingStyle = {},
  articleMode = false,
  articleInitialText,
  articleBackTo = "/library",
  articleBackLabel = "Library",
}: HomeV2_4PageProps) => {
  const persistComposerContent = !articleMode && digSourceUrl !== DIG_SOURCE_URL;
  const [copied, setCopied] = useState(false);
  const [composerCopied, setComposerCopied] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [mode, setMode] = useState<"digtext" | "input">(() =>
    articleMode ? "digtext" : (getStoredComposerMode() as "digtext" | "input"),
  );
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>(
    () => getStoredPreviewLayout(),
  );
  const [composerFullscreenOpen, setComposerFullscreenOpen] =
    useState(articleMode);
  const [heroDemoOpen, setHeroDemoOpen] = useState(false);
  const [inputText, setInputText] = useState(() =>
    articleMode
      ? articleInitialText ?? ""
      : persistComposerContent
        ? getStoredComposerText(digSourceUrl)
        : INITIAL_TEXT,
  );
  const [textareaSelection, setTextareaSelection] = useState<TextAreaSelection>({
    start: 0,
    end: 0,
  });
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [showExpandAllLabel, setShowExpandAllLabel] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>(() =>
    parseToEditableLines(
      articleMode
        ? articleInitialText ?? ""
        : persistComposerContent
          ? getStoredComposerText(digSourceUrl)
          : INITIAL_TEXT,
    ),
  );
  const editorRef = useRef<EditableLineViewHandle>(null);
  const inlinePreviewRef = useRef<InlineParagraphPreviewHandle>(null);
  const listPreviewRef = useRef<EditableLineViewHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const expandAllButtonRef = useRef<HTMLButtonElement>(null);
  const expandAllButtonSizerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaMirrorRef = useRef<HTMLDivElement>(null);
  const isTextareaSelectingRef = useRef(false);
  const pendingSelectionRef = useRef<TextAreaSelection | null>(null);
  const textAreaCurrentRef = useRef<TextAreaHistoryEntry>({
    value: inputText,
    selection: { start: 0, end: 0 },
  });
  const textAreaPastRef = useRef<TextAreaHistoryEntry[]>([]);
  const textAreaFutureRef = useRef<TextAreaHistoryEntry[]>([]);
  const textAreaBatchRef = useRef<TextAreaHistoryBatch | null>(null);
  const linesRef = useRef(lines);
  const pastRef = useRef<EditableLine[][]>([]);
  const futureRef = useRef<EditableLine[][]>([]);
  const applyingHistoryRef = useRef(false);
  const composerSourceBackedRef = useRef(
    articleMode
      ? false
      : persistComposerContent
        ? getStoredComposerSourceBacked(digSourceUrl)
        : true,
  );
  const [, forceUpdate] = useState(0);
  const handlePreviewUpdate = useCallback(() => forceUpdate((n) => n + 1), []);
  const location = useLocation();
  useEffect(() => { forceUpdate((n) => n + 1); }, []);
  useEffect(() => { forceUpdate((n) => n + 1); }, [previewLayout]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    if (articleMode) return;
    try {
      const storedState = {
        mode,
        previewLayout,
        sourceUrl: digSourceUrl,
        ...(persistComposerContent
          ? {
              inputText,
              sourceBacked: composerSourceBackedRef.current,
            }
          : {}),
      };

      window.localStorage.setItem(
        COMPOSER_STORAGE_KEY,
        JSON.stringify(storedState),
      );
    } catch {
      /* ignore */
    }
  }, [articleMode, digSourceUrl, inputText, mode, persistComposerContent, previewLayout]);

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
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyComposerText = async () => {
    try {
      await navigator.clipboard.writeText(inputText);
      setComposerCopied(true);
      setTimeout(() => setComposerCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setComposerFullscreen = useCallback((open: boolean) => {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };

    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => {
        setComposerFullscreenOpen(open);
      });
      return;
    }

    setComposerFullscreenOpen(open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(PROMPT_URL)
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        if (!cancelled && text) setPromptText(text.trim());
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    window.setTimeout(() => scrollTo(id), 0);
  }, [location.hash]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("digtext:open-composer") !== "1") {
        return;
      }
      window.sessionStorage.removeItem("digtext:open-composer");
      setComposerFullscreen(true);
    } catch {
      /* ignore */
    }
  }, [setComposerFullscreen]);

  useEffect(() => {
    if (!composerFullscreenOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setComposerFullscreen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerFullscreenOpen, setComposerFullscreen]);

  const handleLinesChange = useCallback((newLines: EditableLine[]) => {
    composerSourceBackedRef.current = false;
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

  const commitTextareaEntry = useCallback((
    entry: TextAreaHistoryEntry,
    options?: { sourceBacked?: boolean },
  ) => {
    composerSourceBackedRef.current = options?.sourceBacked ?? false;
    textAreaCurrentRef.current = entry;
    setInputText(entry.value);
    setLines(parseToEditableLines(entry.value));
    pendingSelectionRef.current = entry.selection;
  }, []);

  const reloadDigSource = useCallback(async (timestamp?: number) => {
    if (articleMode || !composerSourceBackedRef.current) return;

    const url = timestamp
      ? `${digSourceUrl}${digSourceUrl.includes("?") ? "&" : "?"}t=${timestamp}`
      : digSourceUrl;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;

      const text = await response.text();
      if (!text || !composerSourceBackedRef.current) return;

      const nextText = normalizePastedListText(text.trim());
      const nextEntry = {
        value: nextText,
        selection: { start: 0, end: 0 },
      };
      textAreaPastRef.current = [];
      textAreaFutureRef.current = [];
      textAreaBatchRef.current = null;
      pastRef.current = [];
      futureRef.current = [];
      commitTextareaEntry(nextEntry, { sourceBacked: true });
    } catch {
      /* keep the embedded fallback */
    }
  }, [articleMode, commitTextareaEntry, digSourceUrl]);

  useEffect(() => {
    void reloadDigSource();
  }, [reloadDigSource]);

  useEffect(() => {
    if (articleMode || !import.meta.hot) return;

    const handleDigSourceUpdated = (data?: { url?: string; timestamp?: number }) => {
      if (data?.url !== digSourceUrl) return;
      void reloadDigSource(data.timestamp);
    };

    import.meta.hot.on(DIG_SOURCE_UPDATED_EVENT, handleDigSourceUpdated);
    return () => {
      import.meta.hot?.off(DIG_SOURCE_UPDATED_EVENT, handleDigSourceUpdated);
    };
  }, [articleMode, digSourceUrl, reloadDigSource]);

  // Article mode: when the article prop changes (navigating to a different
  // article), reset the composer with the new article's content.
  useEffect(() => {
    if (!articleMode) return;
    const nextText = articleInitialText ?? "";
    textAreaPastRef.current = [];
    textAreaFutureRef.current = [];
    textAreaBatchRef.current = null;
    pastRef.current = [];
    futureRef.current = [];
    commitTextareaEntry(
      { value: nextText, selection: { start: 0, end: 0 } },
      { sourceBacked: false },
    );
  }, [articleMode, articleInitialText, commitTextareaEntry]);

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

  // Click-to-place-caret on wrapped rows: the textarea and the mirror use
  // different wrap geometry (the mirror has a per-level hanging indent, the
  // textarea wraps at column 0), so a native click against the textarea can
  // land on the wrong line. We hit-test the mirror layer instead via
  // caretRangeFromPoint / caretPositionFromPoint and remap the final caret
  // position on mouseup whenever the interaction was a single click (no
  // drag, click count = 1). Drag selection and double/triple-click keep
  // native behavior. See input-process.md → "Caret alignment on wrapped
  // lines" for the rationale.
  const computeSourceOffsetFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const mirror = textareaMirrorRef.current;
      const textarea = textareaRef.current;
      if (!mirror || !textarea) return null;

      const previousTextareaPE = textarea.style.pointerEvents;
      const previousMirrorPE = mirror.style.pointerEvents;
      textarea.style.pointerEvents = "none";
      mirror.style.pointerEvents = "auto";

      try {
        type DocWithCaret = Document & {
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
          caretPositionFromPoint?: (
            x: number,
            y: number,
          ) => { offsetNode: Node; offset: number } | null;
        };
        const doc = document as DocWithCaret;
        let caretContainer: Node | null = null;
        let caretOffset = 0;

        const range = doc.caretRangeFromPoint?.(clientX, clientY);
        if (range) {
          caretContainer = range.startContainer;
          caretOffset = range.startOffset;
        } else if (doc.caretPositionFromPoint) {
          const pos = doc.caretPositionFromPoint(clientX, clientY);
          if (pos) {
            caretContainer = pos.offsetNode;
            caretOffset = pos.offset;
          }
        }
        if (!caretContainer) return null;

        let lineEl: HTMLElement | null = null;
        let node: Node | null = caretContainer;
        while (node && node !== mirror) {
          if (
            node instanceof HTMLElement &&
            node.hasAttribute("data-mirror-line")
          ) {
            lineEl = node;
            break;
          }
          node = node.parentNode;
        }
        if (!lineEl) return null;

        const rawLines = textarea.value.split("\n");
        const lineIndex = Number(lineEl.getAttribute("data-mirror-line"));
        if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= rawLines.length) {
          return null;
        }

        // Count rendered chars from the start of the line div up to the
        // caret position.  The mirror renders `visual.text` (source line
        // with the leading whitespace stripped), so rendered offset maps
        // 1:1 into `visual.text`; bullet glyph replacement ("*" → "•") is
        // a same-length swap, so indices stay aligned.
        const preRange = document.createRange();
        preRange.setStart(lineEl, 0);
        preRange.setEnd(caretContainer, caretOffset);
        const renderedOffset = preRange.toString().length;

        const lineStarts = getLineStarts(rawLines);
        const hiddenPrefix =
          rawLines[lineIndex].match(/^[\t ]*/)?.[0].length ?? 0;
        const sourceOffset =
          (lineStarts[lineIndex] ?? 0) + hiddenPrefix + renderedOffset;

        const lineEnd =
          (lineStarts[lineIndex] ?? 0) + rawLines[lineIndex].length;
        return Math.min(sourceOffset, lineEnd);
      } finally {
        textarea.style.pointerEvents = previousTextareaPE;
        mirror.style.pointerEvents = previousMirrorPE;
      }
    },
    [],
  );

  const textareaMouseDownPointRef = useRef<{
    x: number;
    y: number;
    withShift: boolean;
  } | null>(null);

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

  const setTextareaValue = useCallback(
    (value: string) => {
      if (value === textAreaCurrentRef.current.value) return;

      applyTextareaUpdate(
        value,
        { start: 0, end: 0 },
        {
          history: "push",
          batchKind: null,
        },
      );
    },
    [applyTextareaUpdate],
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
        const cursorOnly =
          selectionStart === selectionEnd && startIndex === endIndex;

        // Indent validation (single-line, cursor-only, non-dedent).  The
        // line immediately above must be non-blank, and its level must be
        // in [currentLevel, currentLevel + 1] — i.e. a sibling (same level)
        // or a direct parent (one deeper than current).  Both directions
        // matter:
        //   • prev shallower than current → we'd over-indent into an
        //     orphan position (e.g. tab a L1 child when its L0 parent is
        //     the line above → new L2 has no L1 parent).
        //   • prev more than one deeper than current → the new level
        //     would be disconnected from the outline above (e.g. "we've
        //     read" at L0 right after a L3 wrap: tab to L1 has no L0
        //     parent directly above).
        // Dedent (shift) is always allowed.
        if (!event.shiftKey && cursorOnly) {
          const currentLevel = getIndentLevel(rawLines[startIndex]);
          const prevLine = startIndex > 0 ? rawLines[startIndex - 1] : "";
          const prevIsBlank = !prevLine.trim();
          if (prevIsBlank) return;
          const prevLevel = getIndentLevel(prevLine);
          if (prevLevel < currentLevel) return;
          if (prevLevel > currentLevel + 1) return;
        }

        // Only expand to the whole sub-block when the caret sits on a
        // non-empty line. On an empty line `getBlockEndIndex` would greedily
        // swallow every following line that has more indent than 0, which is
        // the bug that made Enter → Tab select the next bullet.
        const currentLineIsEmpty = !rawLines[startIndex]?.trim();
        const useWholeBlock = cursorOnly && !currentLineIsEmpty;
        const targetEndIndex = useWholeBlock
          ? getBlockEndIndex(rawLines, startIndex) - 1
          : endIndex;

        const nextLines = [...rawLines];
        let firstLineDelta = 0;
        for (let index = startIndex; index <= targetEndIndex; index += 1) {
          const before = nextLines[index];
          const after = event.shiftKey ? dedentLine(before) : indentLine(before);
          nextLines[index] = after;
          if (index === startIndex) firstLineDelta = after.length - before.length;
        }

        if (cursorOnly) {
          // Preserve the caret position, just nudged by the indent delta. This
          // replaces the earlier "select the whole line" behavior that made
          // typing accidentally overwrite the line.
          const nextLineStarts = getLineStarts(nextLines);
          const lineStart = nextLineStarts[startIndex] ?? 0;
          const nextCursor = Math.max(lineStart, selectionStart + firstLineDelta);
          applyTextareaUpdate(
            nextLines.join("\n"),
            { start: nextCursor, end: nextCursor },
            {
              history: "push",
              batchKind: null,
            },
          );
        } else {
          const selection = getOffsetsForLineSpan(
            nextLines,
            startIndex,
            targetEndIndex + 1,
          );
          applyTextareaUpdate(nextLines.join("\n"), selection, {
            history: "push",
            batchKind: null,
          });
        }
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const { value, selectionStart, selectionEnd } = event.currentTarget;
        if (selectionStart !== selectionEnd) return;

        const rawLines = value.split("\n");
        const starts = getLineStarts(rawLines);
        const lineIndex = findLineIndexAtOffset(rawLines, selectionStart);
        const currentLine = rawLines[lineIndex] ?? "";
        const lineStart = starts[lineIndex] ?? 0;
        const posInLine = selectionStart - lineStart;

        const bulletLineMatch = currentLine.match(
          /^([\t ]*)([-*+•])(\s+)(.*)$/,
        );
        if (!bulletLineMatch) return;

        const [, indent, bullet, space, content] = bulletLineMatch;
        const prefixLength = indent.length + bullet.length + space.length;

        if (posInLine < prefixLength) return;

        event.preventDefault();

        if (!content.trim()) {
          const before = value.slice(0, lineStart);
          const after = value.slice(lineStart + currentLine.length);
          const nextValue = before + after;
          const cursor = lineStart;
          applyTextareaUpdate(
            nextValue,
            { start: cursor, end: cursor },
            { history: "push", batchKind: null },
          );
          return;
        }

        const insertion = `\n${indent}${bullet} `;
        const nextValue =
          value.slice(0, selectionStart) +
          insertion +
          value.slice(selectionEnd);
        const cursor = selectionStart + insertion.length;
        applyTextareaUpdate(
          nextValue,
          { start: cursor, end: cursor },
          { history: "push", batchKind: null },
        );
        return;
      }

      if (!isMacReorderShortcut) return;

      event.preventDefault();
      const { value, selectionStart } = event.currentTarget;
      const rawLines = value.split("\n");
      const startIndex = findLineIndexAtOffset(rawLines, selectionStart);

      if (!rawLines[startIndex]?.trim()) return;

      // Cmd+Shift+Up/Down walks the current line (together with its
      // children, i.e. its whole sub-block) through every allowed
      // (position, indent) slot.  The rules, matching the spec image:
      //
      //   UP:
      //     • if we can still go deeper at this position
      //       (currentLevel < prevLevel + 1): just increment the whole
      //       block's indent by 1.
      //     • else swap our block with the single line immediately
      //       above, and take that line's level as our new indent
      //       (so we become a sibling of what was previously above us).
      //     • if there is no prev line: no-op.
      //
      //   DOWN: symmetric.
      //     • if there is a next line below our block: swap with that
      //       single line and set our indent to nextLineLevel + 1
      //       (so we become a deepest-valid child of it).
      //     • else (we're at the tail), decrement indent by 1.  No-op
      //       if already at 0.
      //
      // The block "moves with its children" because we always operate
      // on [startIndex, blockEnd).  The single prev/next line we swap
      // with keeps ITS subtree in place — only that single line
      // crosses our block.
      const direction = event.key === "ArrowUp" ? "up" : "down";
      const blockEnd = getBlockEndIndex(rawLines, startIndex);
      const currentLevel = getIndentLevel(rawLines[startIndex]);
      const oldLineStart = getLineStarts(rawLines)[startIndex] ?? 0;
      const offsetInLine = selectionStart - oldLineStart;

      const shiftBlockBy = (lines: string[], delta: number) =>
        lines.map((line) => {
          if (delta === 0) return line;
          if (delta > 0) return INDENT_TOKEN.repeat(delta) + line;
          let result = line;
          for (let i = 0; i < -delta; i += 1) result = dedentLine(result);
          return result;
        });

      const commit = (
        nextLines: string[],
        newBlockStartIndex: number,
        newLevel: number,
      ) => {
        const newStarts = getLineStarts(nextLines);
        const newLineStart = newStarts[newBlockStartIndex] ?? 0;
        const delta = newLevel - currentLevel;
        const newCursor = Math.max(newLineStart, newLineStart + offsetInLine + delta);
        applyTextareaUpdate(
          nextLines.join("\n"),
          { start: newCursor, end: newCursor },
          { history: "push", batchKind: null },
        );
      };

      if (direction === "up") {
        let prevIndex = startIndex - 1;
        while (prevIndex >= 0 && !rawLines[prevIndex].trim()) prevIndex -= 1;

        if (prevIndex < 0) {
          // No block above: can only decrement indent as a mercy move so
          // a line at an orphaned depth can climb out.  Match DOWN's
          // behavior at the tail: decrement by 1 if > 0, else no-op.
          if (currentLevel <= 0) return;
          const newBlock = shiftBlockBy(rawLines.slice(startIndex, blockEnd), -1);
          const nextLines = [...rawLines];
          nextLines.splice(startIndex, blockEnd - startIndex, ...newBlock);
          commit(nextLines, startIndex, currentLevel - 1);
          return;
        }

        const prevLevel = getIndentLevel(rawLines[prevIndex]);

        if (currentLevel < prevLevel + 1) {
          // Still room to go deeper under prev — just indent the block.
          const newBlock = shiftBlockBy(rawLines.slice(startIndex, blockEnd), 1);
          const nextLines = [...rawLines];
          nextLines.splice(startIndex, blockEnd - startIndex, ...newBlock);
          commit(nextLines, startIndex, currentLevel + 1);
          return;
        }

        // At max depth under prev — swap our block with the single prev
        // line (preserving any blank lines between prev and us in place).
        // Our new level = prev's level (so we slot in as a sibling of
        // whatever prev was a sibling of).
        const blockLines = shiftBlockBy(
          rawLines.slice(startIndex, blockEnd),
          prevLevel - currentLevel,
        );
        const prevLine = rawLines[prevIndex];
        const nextLines = [
          ...rawLines.slice(0, prevIndex),
          ...blockLines,
          ...rawLines.slice(prevIndex + 1, startIndex),
          prevLine,
          ...rawLines.slice(blockEnd),
        ];
        commit(nextLines, prevIndex, prevLevel);
        return;
      }

      // DOWN
      let nextIndex = blockEnd;
      while (
        nextIndex < rawLines.length &&
        !rawLines[nextIndex].trim()
      ) {
        nextIndex += 1;
      }

      if (nextIndex >= rawLines.length) {
        // At the tail: just decrement indent by 1.
        if (currentLevel <= 0) return;
        const newBlock = shiftBlockBy(rawLines.slice(startIndex, blockEnd), -1);
        const nextLines = [...rawLines];
        nextLines.splice(startIndex, blockEnd - startIndex, ...newBlock);
        commit(nextLines, startIndex, currentLevel - 1);
        return;
      }

      // Swap with the single next line (preserving that line's subtree
      // in place below).  New indent = nextLineLevel + 1 so we land as
      // its deepest-valid child.
      const nextLevel = getIndentLevel(rawLines[nextIndex]);
      const newLoremLevel = nextLevel + 1;
      const downBlockLines = shiftBlockBy(
        rawLines.slice(startIndex, blockEnd),
        newLoremLevel - currentLevel,
      );
      const nextLine = rawLines[nextIndex];
      const nextLinesDown = [
        ...rawLines.slice(0, startIndex),
        nextLine,
        ...rawLines.slice(blockEnd, nextIndex),
        ...downBlockLines,
        ...rawLines.slice(nextIndex + 1),
      ];
      // newBlockStart = startIndex (old) + 1 (for the moved next line)
      // + (nextIndex - blockEnd) (for any blank lines preserved between).
      const newBlockStart = startIndex + 1 + (nextIndex - blockEnd);
      commit(nextLinesDown, newBlockStart, newLoremLevel);
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

  const renderMirrorSegment = useCallback((text: string, bulletDisplay: string | null) => {
    if (!text) return null;
    if (!bulletDisplay || !text.startsWith("* ")) return text;

    return (
      <>
        {bulletDisplay}{" "}{text.slice(2)}
      </>
    );
  }, []);

  const textareaMirrorLines = useMemo(() => {
    const rawLines = inputText.split("\n");
    const lineStarts = getLineStarts(rawLines);
    const selectionStart = Math.min(textareaSelection.start, textareaSelection.end);
    const selectionEnd = Math.max(textareaSelection.start, textareaSelection.end);
    const isCursorOnly = textareaSelection.start === textareaSelection.end;
    const cursorPos = isCursorOnly ? textareaSelection.start : -1;
    const cursorLineIndex = cursorPos >= 0 ? findLineIndexAtOffset(rawLines, cursorPos) : -1;

    return rawLines.map((line, index) => {
      const visual = getVisualLineData(line);
      const lineStart = lineStarts[index] ?? 0;
      const lineEnd = lineStart + line.length;
      const selectedStart = Math.max(selectionStart, lineStart);
      const selectedEnd = Math.min(selectionEnd, lineEnd);
      const hasSelection = selectedEnd > selectedStart;
      const cursorOffset =
        cursorLineIndex === index
          ? Math.max(0, cursorPos - lineStart - visual.hiddenPrefixLength)
          : null;

      if (!hasSelection) {
        return {
          ...visual,
          beforeText: visual.text,
          selectedText: "",
          afterText: "",
          cursorOffset,
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
        cursorOffset,
      };
    });
  }, [inputText, textareaSelection]);

  const previewParagraphs = useMemo(
    () => parseInlineDocument(inputText, VISUAL_INDENT_UNIT),
    [inputText],
  );

  const paragraphBreakSpacingById = useMemo(() => {
    const counts = getParagraphBreakCountsByLineId(
      inputText,
      lines.map((line) => line.id),
    );

    return new Map(
      Array.from(counts.entries()).map(([lineId, blankLinesBefore]) => [
        lineId,
        getPreviewParagraphSpacing(blankLinesBefore) ?? PREVIEW_PARAGRAPH_BREAK_SPACING,
      ]),
    );
  }, [inputText, lines]);
  const activePreviewHandle =
    previewLayout === "list"
      ? listPreviewRef.current
      : inlinePreviewRef.current;

  useLayoutEffect(() => {
    if (mode !== "digtext") {
      setShowExpandAllLabel(false);
      return;
    }

    let frameId = 0;

    const updateVisibility = () => {
      const toolbar = toolbarRef.current;
      const button = expandAllButtonRef.current;
      const sizer = expandAllButtonSizerRef.current;
      const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
      const toolbarGap = toolbarStyle
        ? Number.parseFloat(toolbarStyle.columnGap || toolbarStyle.gap || "0")
        : 0;
      const occupiedToolbarWidth = toolbar
        ? Array.from(toolbar.children).reduce((sum, child) => (
            sum + (child as HTMLElement).getBoundingClientRect().width
          ), 0) + Math.max(0, toolbar.children.length - 1) * toolbarGap
        : 0;

      const nextValue = shouldShowExpandAllLabel({
        toolbarClientWidth: toolbar?.clientWidth ?? 0,
        occupiedToolbarWidth,
        currentButtonWidth: button?.getBoundingClientRect().width ?? 0,
        expandedButtonWidth: sizer?.getBoundingClientRect().width ?? 0,
      });

      setShowExpandAllLabel((current) => (
        current === nextValue ? current : nextValue
      ));
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateVisibility);
    };

    scheduleUpdate();

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          scheduleUpdate();
        });

    if (toolbarRef.current) {
      resizeObserver?.observe(toolbarRef.current);
    }

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [articleMode, mode, showExpandAllLabel]);

  const handleLayoutToggle = useCallback(() => {
    setPreviewLayout((current) => {
      if (current === "inline") {
        const indices = inlinePreviewRef.current?.getExpandedSourceIndices() ?? new Set<number>();
        setTimeout(() => {
          listPreviewRef.current?.setExpandedBySourceIndices(indices);
          handlePreviewUpdate();
        }, 0);
        return "list";
      } else {
        const indices = listPreviewRef.current?.getExpandedSourceIndices() ?? new Set<number>();
        setTimeout(() => {
          inlinePreviewRef.current?.setExpandedBySourceIndices(indices);
          handlePreviewUpdate();
        }, 0);
        return "inline";
      }
    });
  }, [forceUpdate]);

  const expandedSourceIndices =
    activePreviewHandle?.getExpandedSourceIndices() ?? new Set<number>();
  const { total: totalWords, visible: visibleWords } = computeBulletWordStats(
    previewParagraphs,
    expandedSourceIndices,
  );
  const totalMinutes = minutesForWords(totalWords);
  const visibleMinutes = minutesForWords(visibleWords);
  const digSectionCount = countExpandableBullets(previewParagraphs);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader onOpenComposer={() => setComposerFullscreen(true)} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-[220px] h-[620px] w-[620px] rounded-full opacity-[.42] blur-[110px] dark:opacity-[.28]"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,.42) 0%, rgba(244,114,182,.22) 42%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-40 h-[420px] w-[420px] rounded-full opacity-[.22] blur-[120px] dark:opacity-[.14]"
          style={{
            background:
              "radial-gradient(circle, rgba(96,165,250,.45) 0%, rgba(167,139,250,.22) 45%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto max-w-[59rem] px-6 pt-16 pb-16">
          {!articleMode && (
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="mb-4">
              <span className={eyebrowClass}>
                <span aria-hidden="true" className={eyebrowRuleClass} />
                A new standard for text
              </span>
            </div>

            {/* Big headline */}
            <h1
              className={cn(topHeroHeadingClassName)}
              style={{
                ...topHeroHeadingStyle,
                fontFamily: "'IBM Plex Serif', Georgia, serif",
                textWrap: "balance",
              }}
            >
              Read the shortest version first.
              <br />
              <span className="text-neutral-500 dark:text-neutral-400">
                Dig{" "}
                <span className="relative inline-block align-baseline">
                  <span className="italic">deeper</span>
                  <button
                    type="button"
                    aria-label={heroDemoOpen ? "Collapse" : "Expand"}
                    onClick={() => setHeroDemoOpen((v) => !v)}
                    className={cn(
                      "relative left-[0.08em] align-middle ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors",
                      heroDemoOpen
                        ? "bg-neutral-900 border-neutral-900 text-white dark:bg-neutral-50 dark:border-neutral-50 dark:text-neutral-900"
                        : "border-neutral-400 text-neutral-500 hover:text-neutral-900 hover:border-neutral-700 dark:border-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-50 dark:hover:border-neutral-400",
                    )}
                  >
                    {heroDemoOpen ? (
                      <X size={12} strokeWidth={2.5} />
                    ) : (
                      <Plus size={12} strokeWidth={2.5} />
                    )}
                  </button>
                </span>
                {" "}only where it matters.
              </span>
            </h1>

            <div
              className="grid transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                gridTemplateRows: heroDemoOpen ? "1fr" : "0fr",
                marginTop: heroDemoOpen ? "1rem" : "0",
              }}
            >
              <div className="overflow-hidden">
                <p
                  className="max-w-2xl font-serif text-[1.08rem] leading-[1.65] text-neutral-600 dark:text-neutral-300"
                  style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                >
                  You got it! This is mostly how dig text works. Read below more below
                </p>
              </div>
            </div>
          </div>
          )}

          {/* ── Reader box ── */}
          {composerFullscreenOpen && (
            <div
              className={cn(
                "fixed overflow-hidden bg-white dark:bg-neutral-950",
                articleMode
                  ? "left-0 right-0 bottom-0 top-[68px] z-10"
                  : "inset-0 z-40",
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-40 -top-[220px] h-[560px] w-[560px] rounded-full opacity-[0.35] blur-[90px] dark:opacity-[0.22]"
                style={{
                  background:
                    "radial-gradient(circle at 35% 35%, rgba(59,130,246,.55), rgba(244,114,182,.28) 42%, rgba(255,255,255,0) 70%)",
                }}
              />
            </div>
          )}
          <div
            className={cn(
              "mt-10 overflow-hidden rounded-[20px] border border-neutral-200/80 bg-neutral-50/70 ring-1 ring-black/[0.02] backdrop-blur-[2px] dark:border-neutral-800 dark:bg-neutral-900/60 dark:ring-white/[0.03]",
              !composerFullscreenOpen && "-mx-5 sm:mx-0",
              composerFullscreenOpen && !articleMode &&
                "fixed inset-0 z-50 mt-0 flex h-dvh flex-col rounded-none border-0 md:inset-y-4 md:left-1/2 md:right-auto md:h-[calc(100dvh-2rem)] md:w-[calc(100%-3rem)] md:max-w-4xl md:-translate-x-1/2 md:rounded-2xl md:border",
              composerFullscreenOpen && articleMode &&
                "fixed left-0 right-0 bottom-0 top-[68px] z-20 mt-0 flex flex-col rounded-none border-0 md:top-[calc(68px+1rem)] md:bottom-4 md:left-1/2 md:right-auto md:w-[calc(100%-3rem)] md:max-w-4xl md:-translate-x-1/2 md:rounded-2xl md:border",
              readerWindowShadowClass,
            )}
            style={{ viewTransitionName: "reader-shell" }}
          >
            {/* Toolbar */}
            <div
              ref={toolbarRef}
              className="flex items-center justify-between gap-2 overflow-x-auto border-b border-neutral-200/70 bg-white/80 px-3 py-2.5 backdrop-blur-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:px-4 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              {articleMode && (
                <Link
                  to={articleBackTo}
                  className={cn(iconButtonClass, "shrink-0")}
                  aria-label={`Back to ${articleBackLabel}`}
                >
                  <ChevronLeft size={20} strokeWidth={1.85} className="relative -left-px" />
                </Link>
              )}
              <div className={cn(shellClass, "shrink-0")}>
                <button
                  onClick={() => setMode("input")}
                  className={cn(pillButtonClass(mode === "input"), "w-[76px] text-center")}
                  type="button"
                >
                  Input
                </button>
                <button
                  onClick={() => setMode("digtext")}
                  className={cn(pillButtonClass(mode === "digtext"), "w-[76px] text-center")}
                  type="button"
                >
                  Preview
                </button>
              </div>

              <div className="ml-auto flex min-h-[34px] shrink-0 items-center justify-end gap-2">
                {mode === "digtext" && (
                  <button
                    ref={expandAllButtonRef}
                    onClick={() => {
                      const h = activePreviewHandle;
                      if (!h) return;
                      if (h.anyExpanded) {
                        h.collapseAll();
                      } else {
                        h.expandAll();
                      }
                    }}
                    className={expandAllButtonClass(showExpandAllLabel)}
                    type="button"
                    aria-label={(activePreviewHandle?.anyExpanded ?? false) ? "Collapse all" : "Expand all"}
                  >
                    {(activePreviewHandle?.anyExpanded ?? false) ? (
                      <CollapseAllIcon />
                    ) : (
                      <ExpandAllIcon />
                    )}
                    <span className={cn(expandAllButtonLabelClass, !showExpandAllLabel && "hidden")}>
                      {(activePreviewHandle?.anyExpanded ?? false) ? "Collapse all" : "Expand all"}
                    </span>
                  </button>
                )}
                {mode === "digtext" && (
                  <button
                    type="button"
                    onClick={handleLayoutToggle}
                    className={layoutIconButtonClass(previewLayout === "list")}
                    aria-label={
                      previewLayout === "list"
                        ? "Use inline preview"
                        : "Use list preview"
                    }
                    aria-pressed={previewLayout === "list"}
                  >
                    {listPreviewIcon}
                  </button>
                )}
                {mode === "input" && inputMode === "textarea" && (
                  <div className={cn(shellClass, "shrink-0")}>
                    <button
                      onClick={() =>
                        setTextareaValue(inputText.trim() ? "" : INITIAL_TEXT)
                      }
                      className={pillButtonClass(false)}
                      type="button"
                    >
                      {inputText.trim() ? "Clear" : "Sample"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCopyComposerText}
                  className={iconButtonClass}
                  aria-label="Copy input markdown"
                >
                  {composerCopied ? (
                    <Check size={16} strokeWidth={2} />
                  ) : (
                    <Copy size={16} strokeWidth={1.85} />
                  )}
                </button>
                {!articleMode && (composerFullscreenOpen ? (
                  <button
                    type="button"
                    onClick={() => setComposerFullscreen(false)}
                    className={iconButtonClass}
                    aria-label="Close composer"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setComposerFullscreen(true)}
                    className={iconButtonClass}
                    aria-label="Open full screen"
                  >
                    <Maximize2 size={16} strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            </div>
            {mode === "digtext" && (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
              >
                <div ref={expandAllButtonSizerRef} className={expandAllButtonClass(true)}>
                  <CollapseAllIcon />
                  <span className={expandAllButtonLabelClass}>Collapse all</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div
              className={cn(
                "h-[460px] overflow-y-auto px-6 pt-6 pb-7 md:h-[520px] md:px-10 md:pt-8 md:pb-9",
                composerFullscreenOpen && "h-auto flex-1 md:h-auto",
                mode === "input" &&
                  inputMode === "textarea" &&
                  "overflow-hidden p-0 md:p-0",
                composerFullscreenOpen &&
                  mode === "input" &&
                  inputMode === "textarea" &&
                  "flex-1 overflow-hidden",
              )}
            >
              {mode === "input" && inputMode === "editable-line" ? (
                <EditableLineView
                  ref={editorRef}
                  lines={lines}
                  onLinesChange={handleLinesChange}
                  onCollapseChange={handlePreviewUpdate}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  variant="bullets"
                  className="text-zinc-900 dark:text-neutral-200"
                  lineDigIcons={{
                    collapsed: <InlinePreviewDigNewlineIcon />,
                    expanded: <InlinePreviewDigCloseIcon />,
                  }}
                  emptyStateMessage="Paste indented text or a bulleted list here"
                />
              ) : mode === "input" ? (
                <div className="h-full">
                  <div className="relative h-full">
                    <div
                      ref={textareaMirrorRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden px-6 pt-6 pb-7 leading-[1.85] text-zinc-900 dark:text-neutral-300 md:px-10 md:pt-8 md:pb-9"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "15px", tabSize: 4 }}
                    >
                      <div
                        className={cn(
                          "min-h-[460px] md:min-h-[520px]",
                          composerFullscreenOpen && "h-full min-h-0",
                        )}
                      >
                        {inputText.length > 0 ? (
                          textareaMirrorLines.map((visual, index) => {
                            return (
                              <div
                                key={`${index}-${visual.text}`}
                                data-mirror-line={index}
                                className="whitespace-pre-wrap break-words"
                                style={{
                                  paddingLeft: `${visual.paddingLeftCh}ch`,
                                  textIndent: `${visual.textIndentCh}ch`,
                                  minHeight: "1.85em",
                                }}
                              >
                                {visual.selectedText ? (
                                  <>
                                    {renderMirrorSegment(visual.beforeText, visual.bulletDisplay)}
                                    <span className="bg-rose-200/70 dark:bg-rose-500/30">
                                      {renderMirrorSegment(visual.selectedText, visual.bulletDisplay)}
                                    </span>
                                    {renderMirrorSegment(visual.afterText, visual.bulletDisplay)}
                                  </>
                                ) : textareaFocused && visual.cursorOffset !== null ? (
                                  <>
                                    {renderMirrorSegment(visual.text.slice(0, visual.cursorOffset), visual.bulletDisplay)}
                                    <span
                                      aria-hidden="true"
                                      className="relative inline-block"
                                      style={{ width: 0 }}
                                    >
                                      <span
                                        className="absolute bg-[#6155F5]"
                                        style={{ left: 0, top: "-0.8em", width: "1.5px", height: "1em", animation: "textarea-cursor-blink 1.2s step-end infinite" }}
                                      />
                                    </span>
                                    {renderMirrorSegment(visual.text.slice(visual.cursorOffset), visual.bulletDisplay)}
                                  </>
                                ) : (
                                  renderMirrorSegment(visual.text, visual.bulletDisplay) || " "
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className={cn(
                              "min-h-[460px] md:min-h-[520px]",
                              composerFullscreenOpen && "h-full min-h-0",
                            )}
                          >
                            {textareaFocused && (
                              <div style={{ minHeight: "1.85em" }}>
                                <span
                                  aria-hidden="true"
                                  className="relative inline-block"
                                  style={{ width: 0 }}
                                >
                                  <span
                                    className="absolute bg-[#6155F5]"
                                    style={{ left: 0, top: "-0.8em", width: "1.5px", height: "1em", animation: "textarea-cursor-blink 1.2s step-end infinite" }}
                                  />
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleTextareaChange}
                    onPaste={handleTextareaPaste}
                    onKeyDown={handleTextareaKeyDown}
                    onMouseDown={(event) => {
                      isTextareaSelectingRef.current = true;
                      textareaMouseDownPointRef.current = {
                        x: event.clientX,
                        y: event.clientY,
                        withShift: event.shiftKey,
                      };
                      syncTextareaSelection();
                    }}
                    onFocus={() => { setTextareaFocused(true); syncTextareaSelection(); }}
                    onBlur={() => setTextareaFocused(false)}
                    onSelect={syncTextareaSelection}
                    onKeyUp={syncTextareaSelection}
                    onMouseUp={(event) => {
                      const start = textareaMouseDownPointRef.current;
                      textareaMouseDownPointRef.current = null;

                      // Only remap simple single clicks.  Drag selections and
                      // double/triple clicks keep native behavior so word and
                      // line selection still work.
                      const isSimpleClick =
                        start !== null &&
                        event.detail === 1 &&
                        !start.withShift &&
                        Math.abs(event.clientX - start.x) < 3 &&
                        Math.abs(event.clientY - start.y) < 3;

                      if (isSimpleClick) {
                        const sourceOffset = computeSourceOffsetFromPoint(
                          event.clientX,
                          event.clientY,
                        );
                        if (sourceOffset !== null && textareaRef.current) {
                          textareaRef.current.setSelectionRange(
                            sourceOffset,
                            sourceOffset,
                          );
                        }
                      }

                      syncTextareaSelection();
                    }}
                    onScroll={syncTextareaMirrorScroll}
                    spellCheck={false}
                    placeholder={TEXTAREA_PLACEHOLDER}
                    className="relative block h-full w-full resize-none bg-transparent px-6 pt-6 pb-7 leading-[1.85] text-transparent caret-transparent outline-none placeholder:text-neutral-400 selection:bg-transparent dark:placeholder:text-neutral-500 dark:selection:bg-transparent md:px-10 md:pt-8 md:pb-9"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "15px", tabSize: 4 }}
                  />
                  </div>
                </div>
              ) : (
                <>
                  <div className={previewLayout !== "list" ? "hidden" : ""}>
                    {lines.length > 0 ? (
                      <EditableLineView
                        ref={listPreviewRef}
                        lines={lines}
                        onLinesChange={handleLinesChange}
                        onCollapseChange={handlePreviewUpdate}
                        readOnly
                        readOnlyInlineDigSyntax="parentheses"
                        defaultCollapsed
                        readOnlyEndControlsOnly
                        readOnlyTextClassName="text-base leading-[1.85] text-zinc-900 dark:text-neutral-200"
                        readOnlyTextStyle={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                        lineDigCollapsedIcon="enter"
                        lineDigIcons={{
                          collapsed: <InlinePreviewDigNewlineIcon />,
                          expanded: <LinePreviewDigCloseIcon />,
                        }}
                        inlineDigCollapsedIcon="plus"
                        inlineDigIcons={{
                          collapsed: <InlinePreviewDigPlusIcon />,
                          expanded: <InlinePreviewDigCloseIcon />,
                        }}
                        paragraphBreakSpacingById={paragraphBreakSpacingById}
                      />
                    ) : (
                      <div
                        className="text-neutral-400 dark:text-neutral-500"
                        style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                      >
                        Start typing on the Input tab to see your preview here.
                      </div>
                    )}
                  </div>
                  <InlineParagraphPreview
                    ref={inlinePreviewRef}
                    text={inputText}
                    onExpandedChange={handlePreviewUpdate}
                    className={cn(
                      "text-base leading-[1.85] text-zinc-900 dark:text-neutral-200",
                      previewLayout === "list" && "hidden",
                    )}
                    style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                  />
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 bg-white/60 px-4 py-2.5 font-sans text-[12px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
              <span className="tabular-nums">
                {visibleWords} of {totalWords} words · {visibleMinutes} of {totalMinutes} min
              </span>
              <span className="tabular-nums">
                {digSectionCount} dig {digSectionCount === 1 ? "section" : "sections"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex min-h-[42px] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {mode === "input" ? (
              <>
                <span>Move text with</span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  <kbd className={shortcutKeyClass}>Tab</kbd>
                  <kbd className={shortcutKeyClass}>Shift+Tab</kbd>
                  <kbd className={shortcutKeyClass}>Command+Shift+Up</kbd>
                  <kbd className={shortcutKeyClass}>Command+Shift+Down</kbd>
                </span>
              </>
            ) : !articleMode ? (
              <button
                onClick={() => scrollTo("prompt")}
                className="group inline-flex items-center gap-1.5 font-sans text-sm text-neutral-500 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:text-neutral-50"
              >
                Get the prompt
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-y-0.5"
                >
                  ↓
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {!articleMode && (
      <>
      {/* ── PROMPT ── */}
      <section
        id="prompt"
        className="border-t border-neutral-200/70 scroll-mt-[65px] dark:border-neutral-800/80"
      >
        <div className="mx-auto max-w-[59rem] px-6 py-20">
          <span className={eyebrowClass}>
            <span aria-hidden="true" className={eyebrowRuleClass} />
            Dig text with LLMs
          </span>

          <h2
            className="mt-4 tracking-tight text-[clamp(1.9rem,4.6vw,2.8rem)] leading-[1.05]"
            style={{
              fontFamily: "'IBM Plex Serif', Georgia, serif",
              textWrap: "balance",
            }}
          >
            Use this prompt to convert
            <br />
            any text into{" "}
            <span className="italic">
              dig text.
            </span>
          </h2>

          <p className="mt-6 mb-10 max-w-xl font-serif text-[1.08rem] leading-[1.65] text-neutral-600 dark:text-neutral-300">
          Paste this prompt to format any text as Dig text. You can also paste this URL {" "}
          <a
            href="/prompt.md"
            className="underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-500 hover:text-neutral-900 transition-colors dark:decoration-neutral-600 dark:hover:decoration-neutral-400 dark:hover:text-neutral-50"
          >
          digtext.github.io/prompt.md
          </a>{" "}
          before your text and AI will grab the newest prompt for you. This is still a work in progress, but it works fine right now with Claude Opus 4.7, especially if you run it as two prompts.
          If you want to build with Dig text, tell your LLM about it by sharing this URL {" "}
          <a
            href="/llms.txt"
            className="underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-500 hover:text-neutral-900 transition-colors dark:decoration-neutral-600 dark:hover:decoration-neutral-400 dark:hover:text-neutral-50"
          >
          digtext.github.io/llms.txt
          </a>{" "}

          </p>

          {/* Prompt box */}
          <div
            className={cn(
              "rounded-[20px] border border-neutral-200/80 bg-white overflow-hidden dark:bg-neutral-900 dark:border-neutral-800",
              readerWindowShadowClass,
            )}
          >
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-4 py-2.5 dark:border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 font-sans text-[11px] font-medium tracking-[0.18em] uppercase text-neutral-500 dark:text-neutral-400">
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

            <pre className="px-5 py-5 text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap break-words max-h-[480px] overflow-auto dark:text-neutral-300" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {promptText ?? "Loading prompt…"}
            </pre>
          </div>

          <p className="mt-8 font-serif text-sm italic text-neutral-500 dark:text-neutral-400">
            Then read text, collapsed first.
          </p>
        </div>
      </section>

      {/* ── EMBED ── */}
      <section
        id="embed"
        className="relative border-t border-neutral-200/70 bg-neutral-50/60 dark:border-neutral-800/80 dark:bg-neutral-900/40"
      >
        <div className="mx-auto max-w-[59rem] px-6 py-20">
          <span className={eyebrowClass}>
            <span aria-hidden="true" className={eyebrowRuleClass} />
            Use it anywhere
          </span>

          <h2
            className="mt-4 tracking-tight text-[clamp(1.9rem,4.6vw,2.8rem)] leading-[1.05]"
            style={{
              fontFamily: "'IBM Plex Serif', Georgia, serif",
              textWrap: "balance",
            }}
          >
            Embed Dig Text on any
            <br />
            page you already write.
          </h2>

          <p className="mt-6 max-w-xl font-serif text-[1.08rem] leading-[1.65] text-neutral-600 dark:text-neutral-300">
            I am developing a script which will enable you to embed Dig on any
            website. If you need it, drop me a line.
          </p>

          <div className="mt-8">
            <a
              href="#feedback"
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById("feedback");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", "#feedback");
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-transparent px-5 py-2.5 font-sans text-sm text-neutral-600 transition-all hover:-translate-y-px hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-50"
            >
              Coming soon — let me know you want it
            </a>
          </div>
        </div>
      </section>

      {/* ── FEEDBACK ── */}
      <section
        id="feedback"
        className="relative border-t border-neutral-200/70 scroll-mt-[65px] dark:border-neutral-800/80"
      >
        <div className="mx-auto max-w-[59rem] px-6 py-20">
          <span className={eyebrowClass}>
            <span aria-hidden="true" className={eyebrowRuleClass} />
            Still a work in progress
          </span>

          <h2
            className="mt-4 tracking-tight text-[clamp(1.9rem,4.6vw,2.8rem)] leading-[1.05]"
            style={{
              fontFamily: "'IBM Plex Serif', Georgia, serif",
              textWrap: "balance",
            }}
          >
            Feedback
          </h2>

          <p className="mt-6 max-w-xl font-serif text-[1.08rem] leading-[1.65] text-neutral-600 dark:text-neutral-300">
            Dig Text is early. Rough edges? Ideas? I would love to hear from you.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:pawsyshq@gmail.com?subject=Dig%20Text%20feedback"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-sans text-sm text-white shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_6px_20px_-8px_rgba(15,23,42,.4)] transition-all hover:-translate-y-px hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Mail className="h-4 w-4" />
              Drop me a line
            </a>
            <a
              href="https://github.com/digtext/digtext.github.io/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-transparent px-5 py-2.5 font-sans text-sm text-neutral-700 transition-all hover:-translate-y-px hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-neutral-50"
            >
              <Github className="h-4 w-4" />
              Report an issue
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-200/70 dark:border-neutral-800/80">
        <div className="mx-auto max-w-[59rem] px-6 py-12 flex flex-col gap-3 font-sans text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between dark:text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <CirclePlus className="h-3 w-3" aria-hidden="true" />
            Dig Text
            <span aria-hidden="true">:</span>
            read the shortest version first
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href="https://github.com/digtext/digtext.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              <Github className="h-3 w-3" aria-hidden="true" />
              
            </a>
            <span aria-hidden="true">·</span>
            <Link
              to="/p"
              aria-label="Archived pages"
              className="inline-flex items-center transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              <Archive className="h-3 w-3" aria-hidden="true" />
            </Link>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">2026</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              CC BY-SA 4.0
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.pawel.world"
              className="transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              pawel.world
            </a>
          </span>
        </div>
      </footer>
      </>
      )}
    </div>
  );
};

interface HomeV3_3_PolishedFullscreenProps {
  digSourceUrl?: string;
  articleMode?: boolean;
  articleInitialText?: string;
  articleBackTo?: string;
  articleBackLabel?: string;
}

const HomeV3_3_PolishedFullscreen = ({
  digSourceUrl = DIG_SOURCE_URL,
  articleMode,
  articleInitialText,
  articleBackTo,
  articleBackLabel,
}: HomeV3_3_PolishedFullscreenProps) => (
  <HomeV2_4Page
    inputMode="textarea"
    digSourceUrl={digSourceUrl}
    heroFontClassName="font-sans"
    articleMode={articleMode}
    articleInitialText={articleInitialText}
    articleBackTo={articleBackTo}
    articleBackLabel={articleBackLabel}
  />
);

export default HomeV3_3_PolishedFullscreen;

