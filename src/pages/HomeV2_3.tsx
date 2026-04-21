import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Plus, X } from "lucide-react";
import {
  EditableLine,
  EditableLineView,
  EditableLineViewHandle,
  parseToEditableLines,
} from "@/components/archive/home-v2-legacy/EditableLineView";
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

const shellClass =
  "inline-flex items-center rounded-[18px] border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900";

const pillButtonClass = (active = false) =>
  cn(
    "rounded-[16px] px-3 py-1.5 font-sans text-[14px] leading-none transition-colors",
    active
      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const HomeV2_3 = () => {
  const [copied, setCopied] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>(() =>
    parseToEditableLines(DEMO_CONTENT),
  );
  const editorRef = useRef<EditableLineViewHandle>(null);
  const linesRef = useRef(lines);
  const pastRef = useRef<EditableLine[][]>([]);
  const futureRef = useRef<EditableLine[][]>([]);
  const applyingHistoryRef = useRef(false);
  // Force re-render when collapse state changes inside the editor (and on mount)
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
    // Trigger toolbar re-render for expand/collapse state
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

  const hasContent = lines.length > 0 && lines.some((l) => l.text.trim());
  const handle = editorRef.current;
  const hasExpandables = handle?.hasExpandables ?? false;
  const anyExpanded = handle?.anyExpanded ?? false;

  const actionLabel = anyExpanded ? "Collapse all" : "Expand all";
  const ActionIcon = anyExpanded ? X : Plus;

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
                home v2.3 no input
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
              <div className="flex items-center gap-2 ml-auto">
                {hasContent && hasExpandables && (
                  <div className={shellClass}>
                    <button
                      onClick={() => {
                        if (anyExpanded) {
                          handle?.collapseAll();
                        } else {
                          handle?.expandAll();
                        }
                      }}
                      className={cn(
                        pillButtonClass(false),
                        "inline-flex items-center gap-1.5",
                      )}
                      type="button"
                    >
                      <ActionIcon
                        size={14}
                        strokeWidth={2.25}
                        className="block"
                      />
                      {actionLabel}
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Content */}
            <div className="px-6 pt-6 pb-7 md:px-10 md:pt-8 md:pb-9">
              <EditableLineView
                ref={editorRef}
                lines={lines}
                onLinesChange={handleLinesChange}
                onCollapseChange={() => forceUpdate((n) => n + 1)}
                onUndo={handleUndo}
                onRedo={handleRedo}
                emptyStateMessage="Paste or just write here"
              />
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

export default HomeV2_3;
