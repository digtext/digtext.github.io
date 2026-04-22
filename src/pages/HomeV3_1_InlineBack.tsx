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
import {
  DigCloseIcon,
  DigPlusIcon,
  digCloseButtonClass,
  digIconButtonClass,
} from "@/components/DigIcons";
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
  "underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-500 hover:text-neutral-900 transition-colors dark:decoration-neutral-600 dark:hover:decoration-neutral-400 dark:hover:text-neutral-50";

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

interface InlineBulletRenderProps {
  bullet: InlineBulletNode;
  expandedIds: Set<string>;
  toggle: (id: string) => void;
  depth: number;
}

const InlineBulletRender = ({
  bullet,
  expandedIds,
  toggle,
  depth,
}: InlineBulletRenderProps) => {
  const hasChildren = bullet.children.length > 0;
  const isExpanded = expandedIds.has(bullet.id);

  if (!hasChildren) {
    return <InlineMarkdown text={bullet.text} />;
  }

  const underlineStyle = isExpanded ? getUnderlineStyle(depth) : undefined;
  const buttonUnderlineColor = depth === 0 ? DIG_ACCENT : DIG_ACCENT_FADED;
  const buttonUnderline: CSSProperties | undefined = isExpanded
    ? { boxShadow: `0 1.5px 0 0 ${buttonUnderlineColor}` }
    : undefined;

  const toggleButton = (
    <button
      type="button"
      onClick={() => toggle(bullet.id)}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      className={cn(
        isExpanded ? digCloseButtonClass : softDigIconButtonClass,
        "relative -top-[0.18em] cursor-pointer",
      )}
      style={buttonUnderline}
    >
      {isExpanded ? <DigCloseIcon /> : <DigPlusIcon />}
    </button>
  );

  const textAndToggle = (
    <>
      <InlineMarkdown text={bullet.text} /> {toggleButton}
    </>
  );

  return (
    <>
      {isExpanded ? (
        <span style={underlineStyle}>{textAndToggle}</span>
      ) : (
        textAndToggle
      )}
      {isExpanded &&
        bullet.children.map((child) => (
          <Fragment key={child.id}>
            {" "}
            <InlineBulletRender
              bullet={child}
              expandedIds={expandedIds}
              toggle={toggle}
              depth={depth + 1}
            />
          </Fragment>
        ))}
    </>
  );
};

export interface InlineParagraphPreviewHandle {
  expandAll: () => void;
  collapseAll: () => void;
  anyExpanded: boolean;
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

  useEffect(() => {
    onExpandedChange?.();
  }, [expandedIds, onExpandedChange]);

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
    }),
    [allExpandableIds, expandedIds],
  );

  if (paragraphs.length === 0) {
    return (
      <div className={cn("text-neutral-400 dark:text-neutral-500", className)} style={style}>
        Start typing on the Raw text tab to see your dig text preview here.
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {paragraphs.map((paragraph, pIdx) => (
        <p key={paragraph.id} className={pIdx === 0 ? "" : "mt-5"}>
          {paragraph.bullets.map((bullet, bIdx) => (
            <Fragment key={bullet.id}>
              {bIdx > 0 ? " " : ""}
              <InlineBulletRender
                bullet={bullet}
                expandedIds={expandedIds}
                toggle={toggle}
                depth={0}
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
  const [composerFullscreenOpen, setComposerFullscreenOpen] = useState(false);
  const [heroDemoOpen, setHeroDemoOpen] = useState(false);
  const [inputText, setInputText] = useState(() => getStoredComposerText());
  const [textareaSelection, setTextareaSelection] = useState<TextAreaSelection>({
    start: 0,
    end: 0,
  });
  const [lines, setLines] = useState<EditableLine[]>(() =>
    parseToEditableLines(getStoredComposerText()),
  );
  const editorRef = useRef<EditableLineViewHandle>(null);
  const digTextRef = useRef<InlineParagraphPreviewHandle>(null);
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
  const location = useLocation();
  useEffect(() => { forceUpdate((n) => n + 1); }, []);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COMPOSER_STORAGE_KEY,
        JSON.stringify({ inputText, mode }),
      );
    } catch {
      /* ignore */
    }
  }, [inputText, mode]);

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

        <div className="relative mx-auto max-w-4xl px-6 pt-16 pb-16">
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
                  className={pillButtonClass(mode === "input")}
                  type="button"
                >
                  Raw text
                </button>
                <button
                  onClick={() => setMode("digtext")}
                  className={pillButtonClass(mode === "digtext")}
                  type="button"
                >
                  Dig text
                </button>
              </div>

              <div className="ml-auto flex min-h-[34px] basis-full items-center justify-end gap-2 sm:basis-auto">
                {mode === "digtext" && (
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
                  onCollapseChange={() => forceUpdate((n) => n + 1)}
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
                    onFocus={syncTextareaSelection}
                    onSelect={syncTextareaSelection}
                    onKeyUp={syncTextareaSelection}
                    onMouseUp={syncTextareaSelection}
                    onScroll={syncTextareaMirrorScroll}
                    spellCheck={false}
                    placeholder={TEXTAREA_PLACEHOLDER}
                    className="relative block h-full w-full resize-none bg-transparent leading-[1.85] text-transparent caret-neutral-900 outline-none placeholder:text-neutral-400 selection:bg-transparent dark:caret-neutral-50 dark:placeholder:text-neutral-500 dark:selection:bg-transparent"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "15px", tabSize: 4 }}
                  />
                  </div>
                </div>
              ) : (
                <InlineParagraphPreview
                  ref={digTextRef}
                  text={inputText}
                  onExpandedChange={() => forceUpdate((n) => n + 1)}
                  className="text-base leading-[1.85] text-neutral-800 dark:text-neutral-200"
                  style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                />
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
        <div className="max-w-4xl mx-auto px-6 py-20">
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
        <div className="max-w-4xl mx-auto px-6 py-20">
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
        <div className="max-w-4xl mx-auto px-6 py-12 flex items-center justify-between font-sans text-[12px] text-neutral-500 dark:text-neutral-400">
          <span>Dig text: read the shortest version first.</span>
          <span className="tabular-nums">© 2026</span>
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
