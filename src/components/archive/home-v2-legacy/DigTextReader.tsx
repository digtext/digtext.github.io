import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Maximize2, Plus, X } from "lucide-react";
import {
  DigTextContent,
  type DigTextRenderMode,
  useDigTextState,
} from "./DigText";
import { cn } from "@/lib/utils";

type ReaderView = "digtext" | "raw";

interface DigTextReaderProps {
  content: string;
  mode?: "embedded" | "fullscreen";
  showLayoutToggle?: boolean;
  fullscreenReturnTo?: string;
}

const iconButtonClass = (active = false) =>
  cn(
    "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[18px] border transition-colors",
    active
      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
      : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const shellClass =
  "inline-flex items-center rounded-[18px] border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900";

const pillButtonClass = (active = false) =>
  cn(
    "rounded-[16px] px-3 py-1.5 font-sans text-[14px] leading-none transition-colors",
    active
      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50",
  );

const isReaderView = (value: string | null): value is ReaderView =>
  value === "digtext" || value === "raw";

const isRenderMode = (value: string | null): value is DigTextRenderMode =>
  value === "inline" || value === "indented";

const IndentedLayoutIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 4h9" />
    <path d="M5 8h6.5" />
    <path d="M7.5 12h4" />
  </svg>
);

const RAW_INDENT = "  ";

const formatRawDigTextForIndentedView = (value: string) => {
  const parts = value.split(/(<<|>>)/);
  const output: string[] = [];
  let depth = 0;
  let atLineStart = true;

  const append = (text: string) => {
    output.push(text);
    atLineStart = text.endsWith("\n") ? true : atLineStart && text.length === 0;
    if (text.length > 0 && !text.endsWith("\n")) atLineStart = false;
  };

  const ensureLineStart = () => {
    if (!atLineStart) append("\n");
    if (atLineStart) append(RAW_INDENT.repeat(depth));
  };

  for (const part of parts) {
    if (!part) continue;

    if (part === "<<") {
      ensureLineStart();
      append("<< ");
      depth += 1;
      continue;
    }

    if (part === ">>") {
      if (!atLineStart) append("\n");
      depth = Math.max(0, depth - 1);
      append(`${RAW_INDENT.repeat(depth)}>>\n`);
      continue;
    }

    const lines = part.split("\n");

    lines.forEach((line, index) => {
      if (atLineStart && line.length > 0) append(RAW_INDENT.repeat(depth));
      append(line);
      if (index < lines.length - 1) append("\n");
    });
  }

  return output
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};

const runViewTransition = (update: () => void) => {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => void;
  };

  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => {
      update();
    });
    return;
  }

  update();
};

const DigTextReader = ({
  content,
  mode = "embedded",
  showLayoutToggle = false,
  fullscreenReturnTo = "/about",
}: DigTextReaderProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo<ReaderView>(() => {
    const maybeView = searchParams.get("view");
    return isReaderView(maybeView) ? maybeView : "digtext";
  }, [searchParams]);
  const initialRenderMode = useMemo<DigTextRenderMode>(() => {
    const maybeRenderMode = searchParams.get("layout");
    return isRenderMode(maybeRenderMode) ? maybeRenderMode : "inline";
  }, [searchParams]);
  const [view, setView] = useState<ReaderView>(initialView);
  const [renderMode, setRenderMode] = useState<DigTextRenderMode>(initialRenderMode);
  const [rawContent, setRawContent] = useState(content);
  const [rawEditorContent, setRawEditorContent] = useState(content);
  const renderModeRef = useRef(renderMode);
  const rawContentRef = useRef(rawContent);
  const digTextState = useDigTextState(rawContent);
  const layoutToggleEnabled =
    showLayoutToggle || searchParams.get("layoutToggle") === "1";
  const fullscreenDestination = searchParams.get("from") ?? fullscreenReturnTo;

  useEffect(() => {
    setRawContent(content);
    rawContentRef.current = content;
    setRawEditorContent(
      renderModeRef.current === "indented"
        ? formatRawDigTextForIndentedView(content)
        : content,
    );
  }, [content]);

  useEffect(() => {
    rawContentRef.current = rawContent;
  }, [rawContent]);

  useEffect(() => {
    if (mode === "fullscreen") {
      setView(initialView);
    }
  }, [initialView, mode]);

  useEffect(() => {
    if (mode === "fullscreen") {
      setRenderMode(initialRenderMode);
    }
  }, [initialRenderMode, mode]);

  useEffect(() => {
    renderModeRef.current = renderMode;
    setRawEditorContent(
      renderMode === "indented"
        ? formatRawDigTextForIndentedView(rawContentRef.current)
        : rawContentRef.current,
    );
  }, [renderMode]);

  const buildFullscreenParams = (
    nextView: ReaderView,
    nextRenderMode: DigTextRenderMode,
  ) => {
    const params = new URLSearchParams();

    if (nextView === "raw") params.set("view", "raw");
    if (nextRenderMode === "indented") params.set("layout", "indented");
    if (layoutToggleEnabled) params.set("layoutToggle", "1");
    if (fullscreenDestination) params.set("from", fullscreenDestination);

    return params;
  };

  const setReaderView = (nextView: ReaderView) => {
    setView(nextView);
    if (mode === "fullscreen") {
      setSearchParams(buildFullscreenParams(nextView, renderMode), {
        replace: true,
      });
    }
  };

  const setReaderRenderMode = (nextRenderMode: DigTextRenderMode) => {
    setRenderMode(nextRenderMode);
    if (mode === "fullscreen") {
      setSearchParams(buildFullscreenParams(view, nextRenderMode), {
        replace: true,
      });
    }
  };

  const fullscreenParams = buildFullscreenParams(view, renderMode);
  const fullscreenQuery = fullscreenParams.toString();
  const fullscreenHref = fullscreenQuery ? `/reader?${fullscreenQuery}` : "/reader";
  const openFullscreen = () => runViewTransition(() => navigate(fullscreenHref));
  const exitFullscreen = () =>
    runViewTransition(() => navigate(fullscreenDestination));

  const actionLabel = digTextState.anyExpanded ? "Collapse all" : "Expand all";
  const ActionIcon = digTextState.anyExpanded ? X : Plus;

  const topBar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Reader view" className={shellClass}>
        <button
          role="tab"
          aria-selected={view === "digtext"}
          onClick={() => setReaderView("digtext")}
          className={pillButtonClass(view === "digtext")}
          type="button"
        >
          Dig text
        </button>
        <button
          role="tab"
          aria-selected={view === "raw"}
          onClick={() => setReaderView("raw")}
          className={pillButtonClass(view === "raw")}
          type="button"
        >
          Raw text
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {view === "digtext" && digTextState.hasExpandables && (
          <div className={shellClass}>
            <button
              onClick={digTextState.anyExpanded ? digTextState.collapseAll : digTextState.expandAll}
              className={cn(pillButtonClass(false), "inline-flex items-center gap-1.5")}
              type="button"
            >
              <ActionIcon size={14} strokeWidth={2.25} className="block" />
              {actionLabel}
            </button>
          </div>
        )}

        {layoutToggleEnabled && (
          <button
            onClick={() =>
              setReaderRenderMode(
                renderMode === "inline" ? "indented" : "inline",
              )
            }
            className={iconButtonClass(renderMode === "indented")}
            type="button"
            aria-label={
              renderMode === "indented"
                ? "Use inline expansion layout"
                : "Use indented expansion layout"
            }
            aria-pressed={renderMode === "indented"}
          >
            <IndentedLayoutIcon />
          </button>
        )}

        {mode === "fullscreen" ? (
          <button
            onClick={exitFullscreen}
            className={iconButtonClass()}
            type="button"
            aria-label="Collapse full screen"
          >
            <X size={16} strokeWidth={2} />
          </button>
        ) : (
          <button
            onClick={openFullscreen}
            className={iconButtonClass()}
            type="button"
            aria-label="Open full screen"
          >
            <Maximize2 size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );

  const body = view === "digtext" ? (
    <DigTextContent
      state={digTextState}
      renderMode={renderMode}
      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    />
  ) : (
    <textarea
      value={rawEditorContent}
      onChange={(e) => {
        setRawEditorContent(e.target.value);
        rawContentRef.current = e.target.value;
        setRawContent(e.target.value);
      }}
      spellCheck={false}
      className="min-h-[320px] w-full resize-none bg-transparent font-mono text-[14px] leading-[1.8] text-neutral-700 outline-none dark:text-neutral-300"
    />
  );

  return (
    <div
      className={cn(
        "overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/50",
        mode === "embedded" && "mt-10",
        mode === "embedded" && "rounded-2xl border border-neutral-200 dark:border-neutral-800",
        mode === "fullscreen" &&
          "flex h-full flex-col rounded-none border-0 md:rounded-2xl md:border md:border-neutral-200 md:dark:border-neutral-800",
      )}
      style={{ viewTransitionName: "reader-shell" }}
    >
      <div className="border-b border-neutral-200/70 bg-white/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/70">
        {topBar}
      </div>
      <div
        className={cn(
          "px-6 pt-6 pb-7 md:px-10 md:pt-8 md:pb-9",
          mode === "fullscreen" && "flex-1 overflow-y-auto",
        )}
      >
        {body}
      </div>
    </div>
  );
};

export default DigTextReader;
