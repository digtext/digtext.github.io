import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Copy, Maximize2, Plus, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  EditableLine,
  EditableLineView,
  EditableLineViewHandle,
  parseToEditableLines,
} from "@/components/EditableLineView";
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
- Use our LLM prompt to convert any text into dig text.
    - Find it below.
- You can read any dig text with this reader — hit the full-screen icon to do it without distractions.`;

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
  - Cmd+Shift+Up/Down moves the current item
  - A blank line between bullets starts a new paragraph in the preview`;

const INDENT_TOKEN = "\t";
const VISUAL_INDENT_UNIT = "    ";
const TEXTAREA_HISTORY_BATCH_MS = 900;
const BULLET_WIDTH_CH = 2;
const COMPOSER_STORAGE_KEY = "digtext:home-composer";

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
  "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[18px] border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50";

const layoutIconButtonClass = (active = false) =>
  cn(
    "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[18px] border transition-colors",
    active
      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const listPreviewIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-4 w-4"
    fill="none"
    focusable="false"
  >
    <circle cx="3" cy="4" r="1.05" fill="currentColor" />
    <path
      d="M5.5 4h7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.65"
    />
    <circle cx="4.9" cy="8" r="1.05" fill="currentColor" />
    <path
      d="M7.4 8h5.6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.65"
    />
    <circle cx="6.8" cy="12" r="1.05" fill="currentColor" />
    <path
      d="M9.3 12h4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.65"
    />
  </svg>
);

const readerWindowShadowClass =
  "shadow-[0_1px_0_rgba(0,0,0,.02),0_2px_6px_-2px_rgba(0,0,0,.04),0_24px_56px_-24px_rgba(15,23,42,.18)]";

const eyebrowClass =
  "inline-flex items-center gap-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600 dark:text-neutral-300";

const eyebrowRuleClass =
  "inline-block h-px w-6 bg-neutral-300 align-middle dark:bg-neutral-700";

const shortcutKeyClass =
  "rounded border border-neutral-200 px-1.5 py-[1px] font-mono text-[10px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400";

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

const getStoredComposerText = () => {
  if (typeof window === "undefined") return INITIAL_TEXT;

  try {
    const stored = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!stored) return INITIAL_TEXT;

    const parsed = JSON.parse(stored) as { inputText?: unknown };
    return typeof parsed.inputText === "string" ? parsed.inputText : INITIAL_TEXT;
  } catch {
    return INITIAL_TEXT;
  }
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

interface InlineBulletNode {
  id: string;
  text: string;
  children: InlineBulletNode[];
}

interface InlineParagraphNode {
  id: string;
  bullets: InlineBulletNode[];
}

type PreviewLayout = "inline" | "list";

const parseInlineDocument = (text: string): InlineParagraphNode[] => {
  const lines = text.split("\n");
  const paragraphs: InlineParagraphNode[] = [];
  let currentBullets: InlineBulletNode[] = [];
  let stack: InlineBulletNode[] = [];
  let nodeCounter = 0;
  let paraCounter = 0;

  const flush = () => {
    if (currentBullets.length > 0) {
      paragraphs.push({ id: `para-${paraCounter++}`, bullets: currentBullets });
      currentBullets = [];
    }
    stack = [];
  };

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      flush();
      continue;
    }

    const indentMatch = rawLine.match(/^[\t ]*/)?.[0] ?? "";
    const normalizedIndent = indentMatch.replace(/\t/g, VISUAL_INDENT_UNIT);
    const depth = Math.floor(normalizedIndent.length / VISUAL_INDENT_UNIT.length);

    const rest = rawLine.slice(indentMatch.length);
    const bulletMatch = rest.match(/^[-*+•]\s+(.*)$/);
    const bodyText = (bulletMatch ? bulletMatch[1] : rest).trim();
    if (!bodyText) continue;

    const node: InlineBulletNode = {
      id: `node-${nodeCounter++}`,
      text: bodyText,
      children: [],
    };

    while (stack.length > depth) stack.pop();
    if (stack.length === 0) {
      currentBullets.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  flush();
  return paragraphs;
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

const countExpandableBullets = (paragraphs: InlineParagraphNode[]): number =>
  paragraphs.reduce(
    (total, paragraph) => total + collectExpandableIds(paragraph.bullets).length,
    0,
  );

const linkClassName =
  "text-neutral-500 underline underline-offset-2 decoration-neutral-300 transition-colors hover:text-neutral-700 hover:decoration-neutral-400 dark:text-neutral-400 dark:decoration-neutral-600 dark:hover:text-neutral-200 dark:hover:decoration-neutral-500";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName}
    >
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-neutral-100 px-1 py-[1px] font-mono text-[0.9em] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      {children}
    </code>
  ),
};

const InlineMarkdown = ({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {text}
  </ReactMarkdown>
);

const DIG_ACCENT = "#BDB7EF";
const DIG_ACCENT_FADED = "rgba(189, 183, 239, 0.6)";

const getUnderlineStyle = (depth: number): CSSProperties => ({
  textDecorationLine: "underline",
  textDecorationColor: depth === 0 ? DIG_ACCENT : DIG_ACCENT_FADED,
  textDecorationStyle: depth >= 2 ? "dashed" : "solid",
  textDecorationThickness: "1.5px",
  textUnderlineOffset: "0.22em",
});

const softDigIconButtonClass =
  "group inline-flex h-5 w-5 flex-none items-center justify-center rounded-full align-middle text-[#BDB7EF] transition-colors hover:bg-[#EEECFF] hover:text-[#6155F5] dark:text-[#BDB7EF] dark:hover:bg-[#302A63] dark:hover:text-[#DCD8FF]";

const inlinePreviewCloseButtonClass =
  "group inline-flex h-5 w-5 flex-none items-center justify-center rounded-full align-middle text-neutral-700 no-underline decoration-transparent transition-colors hover:bg-neutral-100/80 hover:text-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-200";

const InlinePreviewDigPlusIcon = () => (
  <svg
    aria-hidden="true"
    className="block h-5 w-5"
    fill="none"
    focusable="false"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="9.5"
      className="transition-colors group-hover:stroke-transparent"
      stroke="#6155F5"
      strokeOpacity="0.4"
    />
    <path
      fill="#6155F5"
      d="M10.6299 13.8154C10.6299 13.9847 10.568 14.1312 10.4443 14.2549C10.3206 14.3786 10.1725 14.4404 10 14.4404C9.82422 14.4404 9.67611 14.3786 9.55566 14.2549C9.43522 14.1312 9.375 13.9847 9.375 13.8154V6.80859C9.375 6.63607 9.43522 6.48796 9.55566 6.36426C9.67611 6.24056 9.82422 6.17871 10 6.17871C10.1725 6.17871 10.3206 6.24056 10.4443 6.36426C10.568 6.48796 10.6299 6.63607 10.6299 6.80859V13.8154ZM6.49902 10.9395C6.3265 10.9395 6.17839 10.8792 6.05469 10.7588C5.93099 10.6351 5.86914 10.4854 5.86914 10.3096C5.86914 10.137 5.93099 9.98893 6.05469 9.86523C6.17839 9.74154 6.3265 9.67969 6.49902 9.67969H13.5059C13.6751 9.67969 13.8216 9.74154 13.9453 9.86523C14.069 9.98893 14.1309 10.137 14.1309 10.3096C14.1309 10.4854 14.069 10.6351 13.9453 10.7588C13.8216 10.8792 13.6751 10.9395 13.5059 10.9395H6.49902Z"
    />
  </svg>
);

const InlinePreviewDigCloseIcon = () => (
  <svg
    aria-hidden="true"
    className="block h-5 w-5"
    fill="none"
    focusable="false"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      className="transition-colors group-hover:stroke-transparent"
      d="M10 0.5C15.2467 0.5 19.5 4.7533 19.5 10C19.5 15.2467 15.2467 19.5 10 19.5C4.7533 19.5 0.5 15.2467 0.5 10C0.5 4.7533 4.7533 0.5 10 0.5Z"
      stroke="#C2C1C1"
    />
    <path
      fill="#363636"
      d="M12.2266 7.22021C12.3021 7.1473 12.3893 7.09912 12.4883 7.07568C12.5898 7.04964 12.6914 7.04964 12.793 7.07568C12.8945 7.10173 12.9831 7.15251 13.0586 7.22803C13.1341 7.30355 13.1849 7.39209 13.2109 7.49365C13.237 7.59521 13.237 7.69678 13.2109 7.79834C13.1875 7.8973 13.1393 7.98454 13.0664 8.06006L7.76953 13.3569C7.69922 13.4272 7.61328 13.4741 7.51172 13.4976C7.41016 13.5236 7.30729 13.5236 7.20312 13.4976C7.10156 13.4741 7.01302 13.4246 6.9375 13.3491C6.86198 13.2736 6.8112 13.1851 6.78516 13.0835C6.76172 12.9819 6.76172 12.8804 6.78516 12.7788C6.8112 12.6772 6.85938 12.5913 6.92969 12.521L12.2266 7.22021ZM13.0664 12.5171C13.1393 12.59 13.1875 12.6772 13.2109 12.7788C13.237 12.8804 13.237 12.9819 13.2109 13.0835C13.1849 13.1851 13.1341 13.2736 13.0586 13.3491C12.9831 13.4246 12.8945 13.4741 12.793 13.4976C12.6914 13.5236 12.5898 13.5249 12.4883 13.5015C12.3893 13.478 12.3021 13.4285 12.2266 13.353L6.92969 8.05615C6.85938 7.98584 6.8125 7.8999 6.78906 7.79834C6.76562 7.69678 6.76562 7.59521 6.78906 7.49365C6.8125 7.39209 6.86198 7.30355 6.9375 7.22803C7.01302 7.1499 7.10156 7.09912 7.20312 7.07568C7.30729 7.05225 7.41016 7.05225 7.51172 7.07568C7.61328 7.09912 7.69922 7.1473 7.76953 7.22021L13.0664 12.5171Z"
    />
  </svg>
);

interface InlineBulletRenderProps {
  bullet: InlineBulletNode;
  expandedIds: Set<string>;
  toggle: (id: string) => void;
  selfDepth: number;
  underlineDepth?: number;
}

const InlineBulletRender = ({
  bullet,
  expandedIds,
  toggle,
  selfDepth,
  underlineDepth,
}: InlineBulletRenderProps) => {
  const hasChildren = bullet.children.length > 0;
  const isExpanded = expandedIds.has(bullet.id);

  const toggleButton = hasChildren ? (
    <button
      type="button"
      onClick={() => toggle(bullet.id)}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      className={cn(
        isExpanded ? inlinePreviewCloseButtonClass : softDigIconButtonClass,
        "relative -top-[0.18em] cursor-pointer",
      )}
    >
      {isExpanded ? <InlinePreviewDigCloseIcon /> : <InlinePreviewDigPlusIcon />}
    </button>
  ) : null;

  return (
    <>
      <InlineMarkdown text={bullet.text} />
      {toggleButton && <span style={{ whiteSpace: "nowrap" }}>{"\u00A0"}{toggleButton}</span>}
      {isExpanded &&
        bullet.children.map((child) => (
          <Fragment key={child.id}>
            {" "}
            <span style={getUnderlineStyle(selfDepth)}>
              <InlineBulletRender
                bullet={child}
                expandedIds={expandedIds}
                toggle={toggle}
                selfDepth={selfDepth + 1}
                underlineDepth={selfDepth}
              />
            </span>
          </Fragment>
        ))}
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

const InlineParagraphPreview = forwardRef<
  InlineParagraphPreviewHandle,
  InlineParagraphPreviewProps
>(({ text, onExpandedChange, className, style }, ref) => {
  const paragraphs = useMemo(() => parseInlineDocument(text), [text]);

  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    paragraphs.forEach((paragraph) => {
      ids.push(...collectExpandableIds(paragraph.bullets));
    });
    return ids;
  }, [paragraphs]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

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
  }, [allExpandableIds]);

  const onExpandedChangeRef = useRef(onExpandedChange);
  useEffect(() => { onExpandedChangeRef.current = onExpandedChange; });
  useEffect(() => {
    onExpandedChangeRef.current?.();
  }, [expandedIds]);

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      expandAll: () => {
        setExpandedIds(new Set(allExpandableIds));
      },
      collapseAll: () => {
        setExpandedIds(new Set());
      },
      get anyExpanded() {
        return expandedIds.size > 0;
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
      },
    }),
    [allExpandableIds, expandedIds],
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
      {paragraphs.map((paragraph, pIdx) => (
        <p key={paragraph.id} className={pIdx === 0 ? "" : "mt-[0.5em]"}>
          {paragraph.bullets.map((bullet, bIdx) => (
            <Fragment key={bullet.id}>
              {bIdx > 0 ? " " : ""}
              <InlineBulletRender
                bullet={bullet}
                expandedIds={expandedIds}
                toggle={toggle}
                selfDepth={0}
              />
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
});

InlineParagraphPreview.displayName = "InlineParagraphPreview";

interface HomeV2_4PageProps {
  inputMode?: "editable-line" | "textarea";
  heroFontClassName?: string;
  heroHeadingClassName?: string;
  heroHeadingStyle?: CSSProperties;
  topHeroHeadingClassName?: string;
  topHeroHeadingStyle?: CSSProperties;
}

export const HomeV2_4Page = ({
  inputMode = "editable-line",
  heroFontClassName = "font-serif",
  heroHeadingClassName = "tracking-[-0.05em] text-[clamp(2.05rem,5.75vw,3.24rem)]",
  heroHeadingStyle = { lineHeight: 1 },
  topHeroHeadingClassName = "mt-3 tracking-tight text-[clamp(2.4rem,6.2vw,3.6rem)] leading-[1.02]",
  topHeroHeadingStyle = {},
}: HomeV2_4PageProps) => {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"digtext" | "input">(
    () => getStoredComposerMode() as "digtext" | "input",
  );
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>(
    () => getStoredPreviewLayout(),
  );
  const [composerFullscreenOpen, setComposerFullscreenOpen] = useState(false);
  const [heroDemoOpen, setHeroDemoOpen] = useState(false);
  const [inputText, setInputText] = useState(() => getStoredComposerText());
  const [textareaSelection, setTextareaSelection] = useState<TextAreaSelection>({
    start: 0,
    end: 0,
  });
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>(() =>
    parseToEditableLines(getStoredComposerText()),
  );
  const editorRef = useRef<EditableLineViewHandle>(null);
  const inlinePreviewRef = useRef<InlineParagraphPreviewHandle>(null);
  const listPreviewRef = useRef<EditableLineViewHandle>(null);
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
  const [, forceUpdate] = useState(0);
  const handlePreviewUpdate = useCallback(() => forceUpdate((n) => n + 1), []);
  const location = useLocation();
  useEffect(() => { forceUpdate((n) => n + 1); }, []);
  useEffect(() => { forceUpdate((n) => n + 1); }, [previewLayout]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COMPOSER_STORAGE_KEY,
        JSON.stringify({ inputText, mode, previewLayout }),
      );
    } catch {
      /* ignore */
    }
  }, [inputText, mode, previewLayout]);

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

  const wordCount = useMemo(() => {
    const trimmed = inputText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [inputText]);

  const previewParagraphs = useMemo(
    () => parseInlineDocument(inputText),
    [inputText],
  );

  const digSectionCount = useMemo(
    () => countExpandableBullets(previewParagraphs),
    [previewParagraphs],
  );

  const paragraphBreakIds = useMemo(() => {
    const ids = new Set<number>();
    const rawLines = inputText.split("\n");
    let lineIndex = 0;
    let prevWasBlank = false;

    for (const rawLine of rawLines) {
      const m = rawLine.match(/^(\s*)(?:[-*+•]\s+)?(.*)/);
      const text = m ? m[2].trim() : "";
      if (!text) {
        prevWasBlank = true;
        continue;
      }
      if (prevWasBlank && lineIndex > 0 && lineIndex < lines.length) {
        ids.add(lines[lineIndex].id);
      }
      prevWasBlank = false;
      lineIndex++;
    }

    return ids;
  }, [inputText, lines]);
  const activePreviewHandle =
    previewLayout === "list"
      ? listPreviewRef.current
      : inlinePreviewRef.current;

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
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="mb-4">
              <span className={eyebrowClass}>
                <span aria-hidden="true" className={eyebrowRuleClass} />
                A new interface for text
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
                      "align-middle ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors",
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
                  Dig text is a new way to read text. You see the shortest
                  version first, then dig deeper only where it matters to you.
                </p>
              </div>
            </div>
          </div>

          {/* ── Reader box ── */}
          {composerFullscreenOpen && (
            <div className="fixed inset-0 z-40 overflow-hidden bg-white dark:bg-neutral-950">
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
              composerFullscreenOpen &&
                "fixed inset-0 z-50 mt-0 flex h-dvh flex-col rounded-none border-0 md:inset-y-4 md:left-1/2 md:right-auto md:h-[calc(100dvh-2rem)] md:w-[calc(100%-3rem)] md:max-w-4xl md:-translate-x-1/2 md:rounded-2xl md:border",
              readerWindowShadowClass,
            )}
            style={{ viewTransitionName: "reader-shell" }}
          >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className={shellClass}>
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

              <div className="ml-auto flex min-h-[34px] basis-full items-center justify-end gap-2 sm:basis-auto">
                {mode === "digtext" && (
                  <div className={shellClass}>
                    <button
                      onClick={() => {
                        const h = activePreviewHandle;
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
                      {(activePreviewHandle?.anyExpanded ?? false) ? (
                        <X size={14} strokeWidth={2.25} className="block" />
                      ) : (
                        <Plus size={14} strokeWidth={2.25} className="block" />
                      )}
                      {(activePreviewHandle?.anyExpanded ?? false) ? "Collapse all" : "Expand all"}
                    </button>
                  </div>
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
                  <div className={shellClass}>
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
                {composerFullscreenOpen ? (
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
                )}
              </div>
            </div>

            {/* Content */}
            <div
              className={cn(
                "h-[460px] overflow-y-auto px-6 pt-6 pb-7 md:h-[520px] md:px-10 md:pt-8 md:pb-9",
                composerFullscreenOpen && "h-auto flex-1 md:h-auto",
                mode === "input" &&
                  inputMode === "textarea" &&
                  "overflow-hidden",
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
                  emptyStateMessage="Paste indented text or a bulleted list here"
                />
              ) : mode === "input" ? (
                <div className="h-full">
                  <div className="relative h-full">
                    <div
                      ref={textareaMirrorRef}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden leading-[1.85] text-neutral-700 dark:text-neutral-300"
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
                                        className="absolute bg-neutral-900 dark:bg-neutral-50"
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
                          />
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
                    onFocus={() => { setTextareaFocused(true); syncTextareaSelection(); }}
                    onBlur={() => setTextareaFocused(false)}
                    onSelect={syncTextareaSelection}
                    onKeyUp={syncTextareaSelection}
                    onMouseUp={syncTextareaSelection}
                    onScroll={syncTextareaMirrorScroll}
                    spellCheck={false}
                    placeholder={TEXTAREA_PLACEHOLDER}
                    className="relative block h-full w-full resize-none bg-transparent leading-[1.85] text-transparent caret-transparent outline-none placeholder:text-neutral-400 selection:bg-transparent dark:placeholder:text-neutral-500 dark:selection:bg-transparent"
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
                        readOnlyTextClassName="text-base leading-[1.85]"
                        readOnlyTextStyle={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                        lineDigCollapsedIcon="enter"
                        inlineDigCollapsedIcon="plus"
                        paragraphBreakIds={paragraphBreakIds}
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
                      "text-base leading-[1.85] text-neutral-800 dark:text-neutral-200",
                      previewLayout === "list" && "hidden",
                    )}
                    style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                  />
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 bg-white/60 px-4 py-2.5 font-sans text-[11px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
              <span className="tabular-nums">
                {wordCount} words · {digSectionCount} dig sections
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  aria-hidden="true"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                Your text stays in your browser.
              </span>
            </div>
          </div>

          <div className="mt-4 flex min-h-[42px] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
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
            ) : (
              <span>Dig text: read the shortest version first.</span>
            )}
          </div>

          <div className="mt-10">
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
          </div>
        </div>
      </section>

      {/* ── PROMPT ── */}
      <section
        id="prompt"
        className="border-t border-neutral-200/70 scroll-mt-[65px] dark:border-neutral-800/80"
      >
        <div className="mx-auto max-w-[59rem] px-6 py-20">
          <span className={eyebrowClass}>
            <span aria-hidden="true" className={eyebrowRuleClass} />
            A new paradigm of using text
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
            Paste this into your favorite LLM with any text you want converted.
            Then drop the output on the{" "}
            <Link
              to="/"
              className="underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-500 hover:text-neutral-900 transition-colors dark:decoration-neutral-600 dark:hover:decoration-neutral-400 dark:hover:text-neutral-50"
            >
              dig text homepage
            </Link>{" "}
            to read it collapsed-first.
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
              {PROMPT}
            </pre>
          </div>

          <p className="mt-8 font-serif text-sm italic text-neutral-500 dark:text-neutral-400">
            Then read the text, collapsed first.
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
            I am developing a script which will enable you to embed on any
            website. If you need it, give me feedback.
          </p>

          <div className="mt-8">
            <a
              href="mailto:pawsyshq@gmail.com?subject=Dig%20text%20embed%20feedback"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-sans text-sm text-white shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_6px_20px_-8px_rgba(15,23,42,.4)] transition-all hover:-translate-y-px hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Send feedback
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-200/70 dark:border-neutral-800/80">
        <div className="mx-auto max-w-[59rem] px-6 py-12 flex flex-col gap-3 font-sans text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between dark:text-neutral-400">
          <span>Dig text: read the shortest version first.</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
    </div>
  );
};

const HomeV3_1_InlineBack = () => (
  <HomeV2_4Page
    inputMode="textarea"
    heroFontClassName="font-sans"
  />
);

export default HomeV3_1_InlineBack;
