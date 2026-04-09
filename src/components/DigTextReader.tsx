import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { DigTextContent, useDigTextState } from "@/components/DigText";
import { cn } from "@/lib/utils";

type ReaderView = "digtext" | "raw";

interface DigTextReaderProps {
  content: string;
  mode?: "embedded" | "fullscreen";
}

const iconButtonClass =
  "inline-flex h-[34px] w-[34px] items-center justify-center rounded-[18px] border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50";

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

const DigTextReader = ({ content, mode = "embedded" }: DigTextReaderProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = useMemo<ReaderView>(() => {
    const maybeView = searchParams.get("view");
    return isReaderView(maybeView) ? maybeView : "digtext";
  }, [searchParams]);
  const [view, setView] = useState<ReaderView>(initialView);
  const digTextState = useDigTextState(content);

  useEffect(() => {
    if (mode === "fullscreen") {
      setView(initialView);
    }
  }, [initialView, mode]);

  const setReaderView = (nextView: ReaderView) => {
    setView(nextView);
    if (mode === "fullscreen") {
      if (nextView === "raw") setSearchParams({ view: "raw" }, { replace: true });
      else setSearchParams({}, { replace: true });
    }
  };

  const fullscreenHref = view === "raw" ? "/reader?view=raw" : "/reader";
  const openFullscreen = () => runViewTransition(() => navigate(fullscreenHref));
  const exitFullscreen = () => runViewTransition(() => navigate("/about"));

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

        {mode === "fullscreen" ? (
          <button
            onClick={exitFullscreen}
            className={iconButtonClass}
            type="button"
            aria-label="Collapse full screen"
          >
            <Minimize2 size={16} strokeWidth={1.75} />
          </button>
        ) : (
          <button onClick={openFullscreen} className={iconButtonClass} type="button" aria-label="Open full screen">
            <Maximize2 size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );

  const body = view === "digtext" ? (
    <DigTextContent state={digTextState} />
  ) : (
    <pre className="font-mono text-[14px] leading-[1.8] text-neutral-700 whitespace-pre-wrap break-words dark:text-neutral-300">
      {content}
    </pre>
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
          "px-6 py-8 md:px-10 md:py-10",
          mode === "fullscreen" && "flex-1 overflow-y-auto",
        )}
      >
        {body}
      </div>
    </div>
  );
};

export default DigTextReader;
