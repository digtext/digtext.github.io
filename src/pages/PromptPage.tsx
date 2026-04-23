import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";

const PromptPage = () => {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/prompt.md")
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => { if (!cancelled && t) setText(t.trim()); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <SiteHeader />
      <main className="mx-auto max-w-[68ch] px-6 py-16">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="font-serif italic text-2xl text-neutral-900 dark:text-neutral-50"
          >
            Dig text prompt
          </h1>
          <button
            onClick={handleCopy}
            disabled={!text}
            aria-label="Copy prompt"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-sans text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300 transition-all disabled:opacity-40 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-neutral-50"
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-emerald-500" />Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5" />Copy</>
            )}
          </button>
        </div>

        <pre
          className="whitespace-pre-wrap break-words text-base leading-relaxed text-neutral-800 dark:text-neutral-200"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px" }}
        >
          {text ?? "Loading…"}
        </pre>

        <p className="mt-10 font-sans text-sm text-neutral-400 dark:text-neutral-500">
          Raw file: <a href="/prompt.md" className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">/prompt.md</a>
        </p>
      </main>
    </div>
  );
};

export default PromptPage;
