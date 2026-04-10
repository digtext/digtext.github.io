import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BulletDigText from "@/components/BulletDigText";
import { cn } from "@/lib/utils";

type ReaderView = "digtext" | "raw";

interface BulletDigTextReaderProps {
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

const BulletDigTextReader = ({ content, mode = "embedded" }: BulletDigTextReaderProps) => {
  const [view, setView] = useState<ReaderView>("digtext");
  const [rawContent, setRawContent] = useState(content);

  useEffect(() => {
    setRawContent(content);
  }, [content]);

  const topBar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Reader view" className={shellClass}>
        <button
          role="tab"
          aria-selected={view === "digtext"}
          onClick={() => setView("digtext")}
          className={pillButtonClass(view === "digtext")}
          type="button"
        >
          Dig text
        </button>
        <button
          role="tab"
          aria-selected={view === "raw"}
          onClick={() => setView("raw")}
          className={pillButtonClass(view === "raw")}
          type="button"
        >
          Raw text
        </button>
      </div>
    </div>
  );

  const body =
    view === "digtext" ? (
      <BulletDigText content={rawContent} />
    ) : (
      <textarea
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
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
      )}
    >
      <div className="border-b border-neutral-200/70 bg-white/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/70">
        {topBar}
      </div>
      <div className="px-6 pt-6 pb-7 md:px-10 md:pt-8 md:pb-9">
        {body}
      </div>
    </div>
  );
};

export default BulletDigTextReader;
