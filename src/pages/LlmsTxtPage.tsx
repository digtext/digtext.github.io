import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteHeader from "@/components/SiteHeader";

const monoFont = "'IBM Plex Mono', monospace";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mt-10 mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mt-6 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-7 mb-5 space-y-2 text-neutral-800 dark:text-neutral-200 marker:text-neutral-500 dark:marker:text-neutral-500">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-7 mb-5 space-y-2 text-neutral-800 dark:text-neutral-200 marker:text-neutral-500 dark:marker:text-neutral-500">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-2 leading-relaxed [&>p]:mb-0 [&>p+p]:mt-3 [&>ol]:mt-2 [&>ul]:mt-2">
      {children}
    </li>
  ),
  code: ({ children, className, ...props }) => {
    const codeText = Array.isArray(children)
      ? children.join("")
      : typeof children === "string"
        ? children
        : "";
    const isBlock = className?.includes("language-") || codeText.includes("\n");

    return isBlock ? (
      <code
        {...props}
        className="block whitespace-pre font-mono text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
      >
        {children}
      </code>
    ) : (
      <code
        {...props}
        className="rounded bg-[#ECECEC] px-1 py-0.5 font-mono text-[0.9em] text-neutral-800 dark:bg-[#212121] dark:text-neutral-200"
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-6 overflow-x-auto rounded-md border border-neutral-200 bg-[#F0F0F0] p-4 text-left dark:border-neutral-800 dark:bg-[#1B1B1B]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 text-neutral-600 dark:text-neutral-400 mb-4">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-500 hover:text-neutral-900 transition-colors dark:decoration-neutral-600 dark:hover:decoration-neutral-400 dark:hover:text-neutral-50"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-neutral-900 dark:text-neutral-50">
      {children}
    </strong>
  ),
  hr: () => (
    <hr className="border-neutral-200 dark:border-neutral-800 my-8" />
  ),
};

const LlmsTxtPage = () => {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/llms.txt")
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => { if (!cancelled && t) setText(t); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <SiteHeader />
      <main
        className="mx-auto max-w-[68ch] px-6 py-16"
        style={{ fontFamily: monoFont, fontSize: "16px" }}
      >
        {text == null ? (
          <p className="text-neutral-400">Loading…</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {text}
          </ReactMarkdown>
        )}

        <p className="mt-10 text-sm text-neutral-400 dark:text-neutral-500">
          Raw file: <a href="/llms.txt" className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">/llms.txt</a>
        </p>
      </main>
    </div>
  );
};

export default LlmsTxtPage;
