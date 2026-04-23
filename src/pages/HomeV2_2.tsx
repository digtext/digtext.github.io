import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import DigTextReader from "@/components/archive/home-v2-legacy/DigTextReader";
import SiteHeader from "@/components/SiteHeader";
import { ABOUT_DEMO_CONTENT } from "@/content/aboutDemoContent";

const PROMPT = `Summarize the following text using what I call the Quote summary approach. Use as many original fragments as possible (with quote symbols) and stitch the quotes together with your own writing to create a comprehensive and precise summary.

Produce the following summaries:

1. 1 min summary ***[note for humans: This is the most important setting in this prompt. Consider changing this number.]***
2. 3x the length of "1."
3. 6x the length of "1."

Now convert the original text into "digText" format — a progressive, collapsed-by-default reading layout. The digText syntax is simple. Wrap any block of text between (( and )) markers to make it collapsible. Like this: ((this entire sentence is hidden by default, and the reader sees only a [+] button that they can click to dig in.)) Each level of nesting adds more detail about its parent. If a reader skips a collapsed block, the surrounding text still makes complete sense on its own.

1. Deconstruct the summaries you prepared in the 1st step in the "digText". The shortest summary stays at the top level (visible by default); all other summaries are nested inside (( )) blocks.
2. Roughly: the top level of dig-text should be the shortest summary you already prepared in the 1st step. 2nd level the 2nd longest summary. 3rd level the 3rd longest summary. And so on. Nest all all of the original information (not only summaries) in collapsed blocks. Nothing is cut — everything is preserved, just collapsed. Feel free to slightly restructure the original summaries so it information flows well for the dig text format.
3. Use the progressive expansion principle. Spread collapsed blocks evenly throughout the text. Avoid clustering them at the ends of paragraphs or concentrating them in one part of the article.
4. Use Markdown for headings, links, and any other formatting present in the original. When the source text has a title and subtitle, render the title as H1 (\`#\`) and the subtitle as italicized text.
5. After you finish, re-read only the top-level visible text — everything outside any (( )) markers. It must read as a coherent, complete summary of the original on its own. If it doesn't, rework it until it does.

Output only the converted text in markdown (with Dig's double-parenthesis markers). The output should be ready to paste directly into dig text.

Now transform the following text:

[paste your text here]`;

const HomeV2_2 = () => {
  const [copied, setCopied] = useState(false);

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
          <div style={{ viewTransitionName: "reader-page-top" }}>
            <div className="mb-10 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 dark:border-neutral-800">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-neutral-500 dark:text-neutral-400">
                  a new interface for text
                </span>
              </div>
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300">
                home v2.2 preview
              </span>
            </div>

            <h1 className="font-serif leading-[1.0] tracking-tight text-[clamp(2.7rem,7.65vw,4.17rem)]">
              Read the{" "}
              <span className="italic bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
                most important{" "}
              </span>
              parts first.
              <br />
              Dig deeper in an{" "}
              <span className="italic bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                indented flow.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl font-serif text-base md:text-[1.07rem] leading-relaxed text-neutral-600 dark:text-neutral-300">
              This preview keeps Home v2&apos;s structure, but adds a second Dig
              Text view. Use the new toolbar icon to shift expanded sections
              into a progressively indented reading stack.
            </p>
          </div>

          <DigTextReader
            content={ABOUT_DEMO_CONTENT}
            showLayoutToggle
            fullscreenReturnTo="/p/home-v2-2"
          />

          <div className="mt-8" style={{ viewTransitionName: "reader-page-top-action" }}>
            <button
              onClick={() => scrollTo("prompt")}
              className="font-sans text-sm text-neutral-400 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
            >
              Get the prompt ↓
            </button>
          </div>
        </div>
      </section>

      <div style={{ viewTransitionName: "reader-page-rest" }}>
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
              <Link
                to="/"
                className="underline underline-offset-2 hover:text-neutral-900 transition-colors dark:hover:text-neutral-50"
              >
                dig text homepage
              </Link>{" "}
              to read it collapsed-first.
            </p>

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
                to="/reader?layoutToggle=1&from=%2Fp%2Fhome-v2-2"
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
    </div>
  );
};

export default HomeV2_2;
