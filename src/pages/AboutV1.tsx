import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import DigText from "@/components/DigText";
import SiteHeader from "@/components/SiteHeader";

const PROMPT = `You are converting a piece of text into "dig text" format — a progressive, collapsed-by-default reading layout.

The syntax is simple. Wrap any block of text between << and >> markers to make it collapsible — the markers behave like parentheses: << opens, >> closes. <<Like this: this entire sentence is hidden by default, and the reader sees only a [+] button that they can click to dig in.>> Each level of nesting adds more detail about its parent. If a reader skips a collapsed block, the surrounding text still makes complete sense on its own.

Rules:

1. Include all of the original information. Nothing is cut — everything is preserved, just collapsed. The most important content stays at the top level (visible by default); supporting detail, examples, and asides go inside << >> blocks.

2. Aim for three or more levels of nesting wherever the content supports it. Inside one << >> block you can open another, and another. Each indent is additional information about its parent — readers who aren't interested can skip it and the sequence still makes sense.

3. Stay as close to the original meaning and voice as possible. Do not summarize so aggressively that nuance dies — collapse, don't crush.

4. Section titles are fine. They can stay at the top level or live inside collapsed blocks.

5. Avoid one- and two-line standalone paragraphs. Merge short fragments into flowing prose, then collapse the lower-priority parts.

6. After you finish, re-read only the top-level visible text — everything outside any << >> markers. It must read as a coherent, complete summary of the original on its own. If it doesn't, rework it until it does.

Output only the converted text. No preamble, no explanation, no code fences. The output should be ready to paste directly into dig text.

Now transform the following text:

<paste your text here>`;

// Demo content written in dig text format (<< opens, >> closes)
const DEMO_CONTENT = `Dig text enables readers to expand the parts of text they find valuable or interesting. <<Nesting has no limit <<every layer is a choice the reader makes, and they don't have to read everything to understand the context of what comes after. When you're done, collapse it all back using the "collapse all" button in the top right.>>>> Try dig text yourself. Anything you wrap between double chevrons becomes collapsible. <<Switch to the Raw text view above to play with it and see exactly how this is written. <<This is an addition to Markdown, so you can bring any Markdown file with double chevrons and read dig text on our homepage.>>>> Use our LLM prompt below to automatically transform any text into dig text.`;

const AboutV1 = () => {
  const [copied, setCopied] = useState(false);
  const [demoView, setDemoView] = useState<"digtext" | "raw">("digtext");

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

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
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
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-neutral-500 dark:text-neutral-400">
              a new interface for text
            </span>
          </div>

          {/* Big headline */}
          <h1 className="font-serif leading-[1.0] tracking-tight text-[clamp(3rem,8.5vw,6.5rem)]">
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

          {/* Sub-headline */}
          <p className="mt-12 max-w-2xl font-serif text-xl md:text-2xl leading-snug text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-900 dark:text-neutral-50">Dig text</span>{" "}
            flips it. Text arrives{" "}
            <span className="italic text-rose-500">collapsed</span>, with most
            important things first. You{" "}
            <span className="italic text-violet-600 dark:text-violet-400">dig</span> only as deep
            as you want.
          </p>

          {/* CTA row */}
          <div className="mt-12 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => scrollTo("example")}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-sans text-sm text-white hover:bg-neutral-700 transition-colors dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              See example
            </button>
            <button
              onClick={() => scrollTo("prompt")}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 font-sans text-sm text-neutral-700 hover:border-neutral-500 hover:text-neutral-900 transition-colors dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:text-neutral-50"
            >
              Get the LLM prompt
            </button>
          </div>
        </div>
      </section>

      {/* ── EXAMPLE ── */}
      <section
        id="example"
        className="border-t border-neutral-100 scroll-mt-[65px] dark:border-neutral-800"
      >
        <div className="max-w-4xl mx-auto px-6 py-24">
          <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
            Example
          </span>

          <h2 className="mt-6 font-serif text-[clamp(2rem,5vw,3.75rem)] leading-tight tracking-tight">
            Start from the{" "}
            <span className="italic bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
              most important.
            </span>
            <br />
            Dig into what{" "}
            <span className="italic bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              interests you.
            </span>
          </h2>

          {/* Embedded live dig text demo */}
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50/50 overflow-hidden dark:bg-neutral-900/50 dark:border-neutral-800">
            {/* Top bar — live demo label left, switcher right */}
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-4 py-2.5 bg-white/70 dark:bg-neutral-900/70 dark:border-neutral-800">
              <span className="font-sans text-[11px] tracking-widest uppercase text-neutral-400">
                live demo
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-full border border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-800">
                <button
                  onClick={() => setDemoView("digtext")}
                  className={`px-3 py-1 rounded-full font-sans text-[11px] tracking-wide transition-all ${
                    demoView === "digtext"
                      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                  }`}
                >
                  Dig text
                </button>
                <button
                  onClick={() => setDemoView("raw")}
                  className={`px-3 py-1 rounded-full font-sans text-[11px] tracking-wide transition-all ${
                    demoView === "raw"
                      ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                  }`}
                >
                  Raw text
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-8 md:px-10 md:py-10">
              {demoView === "digtext" ? (
                <DigText content={DEMO_CONTENT} />
              ) : (
                <pre className="font-mono text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap break-words dark:text-neutral-300">
                  {DEMO_CONTENT}
                </pre>
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
            Paste this into your favorite LLM with any text you want
            converted. Then drop the output on the{" "}
            <Link to="/" className="underline underline-offset-2 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50">
              dig text homepage
            </Link>{" "}
            to read it collapsed-first.
          </p>

          {/* Prompt box */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm dark:bg-neutral-900 dark:border-neutral-800">
            {/* Top bar */}
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

            {/* Body */}
            <pre className="px-5 py-5 font-mono text-[13px] leading-relaxed text-neutral-700 whitespace-pre-wrap break-words max-h-[480px] overflow-auto dark:text-neutral-300">
              {PROMPT}
            </pre>
          </div>

          <p className="mt-8 font-serif text-sm italic text-neutral-400 dark:text-neutral-500">
            Then read what you wrote — collapsed first.
          </p>

          <div className="mt-6">
            <button
              onClick={() => scrollTo("example")}
              className="font-sans text-sm text-neutral-400 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
            >
              ↑ Back to example
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutV1;
