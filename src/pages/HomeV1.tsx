import { useState } from "react";
import { Link } from "react-router-dom";
import DigText from "@/components/DigText";
import SiteHeader from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

type HomeTab = "dig" | "raw";

const PLACEHOLDER = `Paste your text here…

Wrap any block of text between (( and )) markers to make it collapsible.

When you're ready, switch to the Dig text tab above to read it collapsed-first.`;

const HomeV1 = () => {
  const [tab, setTab] = useState<HomeTab>("raw");
  const [rawContent, setRawContent] = useState("");

  const tabBtn = (id: HomeTab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-colors",
        tab === id
          ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Tab switcher — left aligned */}
        <div className="mb-6 flex justify-start">
          <div
            role="tablist"
            aria-label="Home view"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-0.5 dark:bg-neutral-900 dark:border-neutral-800"
          >
            {tabBtn("dig", "Dig text")}
            {tabBtn("raw", "Raw text")}
          </div>
        </div>

        {/* Tab body */}
        {tab === "raw" && (
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className="w-full min-h-[220px] rounded-md border border-neutral-200 bg-neutral-50/50 px-4 py-3 font-mono text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-y dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700"
          />
        )}

        {tab === "dig" && (
          <div className="min-h-[220px]">
            {rawContent.trim() ? (
              <DigText content={rawContent} />
            ) : (
              <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-16 text-center dark:bg-neutral-900/50 dark:border-neutral-800">
                <p className="font-serif text-lg text-neutral-500 mb-2 dark:text-neutral-400">
                  Nothing to dig into yet.
                </p>
                <p className="font-sans text-sm text-neutral-400 dark:text-neutral-500">
                  Switch to{" "}
                  <button
                    onClick={() => setTab("raw")}
                    className="underline underline-offset-2 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
                  >
                    Raw text
                  </button>{" "}
                  and paste something to begin.
                </p>
              </div>
            )}
          </div>
        )}

        {/* About-style footer card — previews the look of the About page */}
        <Link
          to="/about"
          className="group mt-10 block relative overflow-hidden rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700"
        >
          {/* Gradient orbs (mirrors About hero) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-[400px] w-[400px] rounded-full opacity-40 blur-[100px]"
            style={{
              background:
                "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(244,63,94,0.35) 40%, rgba(139,92,246,0.3) 70%, transparent 80%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-20 h-[280px] w-[280px] rounded-full opacity-25 blur-[80px]"
            style={{
              background:
                "radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(244,63,94,0.2) 60%, transparent 80%)",
            }}
          />

          <div className="relative px-8 py-12">
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400">
              What is Dig text?
            </span>

            <h3 className="mt-4 font-serif text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.05] tracking-tight">
              It is{" "}
              <em className="not-italic bg-gradient-to-r from-rose-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                ridiculous
              </em>{" "}
              that we read text in its{" "}
              <em className="not-italic bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
                most expanded
              </em>{" "}
              form by default.
            </h3>

            <p className="mt-5 max-w-xl font-serif text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
              <span className="font-semibold text-neutral-900 dark:text-neutral-50">Dig text</span>{" "}
              flips it. Text arrives{" "}
              <span className="italic text-rose-500">collapsed</span>, with the
              most important things first. You{" "}
              <span className="italic text-violet-600">dig</span> only as deep
              as you want.
            </p>

            <span className="mt-6 inline-flex items-center gap-1.5 font-sans text-sm font-medium text-neutral-900 group-hover:gap-2.5 transition-all dark:text-neutral-50">
              Read more about it
              <span aria-hidden>→</span>
            </span>
          </div>
        </Link>
      </main>
    </div>
  );
};

export default HomeV1;
