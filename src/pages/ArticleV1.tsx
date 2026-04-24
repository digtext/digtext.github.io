import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DigText from "@/components/archive/home-v2-legacy/DigText";
import SiteHeader from "@/components/SiteHeader";
import type { Article } from "@/content/articles";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";
import chinaGayRightsRaw from "@/content/library/archive/china-gay-rights.md?raw";

type ViewTab = "dig" | "raw";

const parseFrontmatter = (raw: string): { data: Record<string, string>; body: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const frontmatterMatch = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (frontmatterMatch) {
      data[frontmatterMatch[1]] = frontmatterMatch[2].trim();
    }
  }

  return { data, body: match[2] };
};

const { data: historicalArticleData, body: historicalArticleBody } =
  parseFrontmatter(chinaGayRightsRaw);

const historicalArticle: Article = {
  id: historicalArticleData.id ?? "china-gay-rights",
  title: historicalArticleData.title ?? "China's reluctance to gay rights",
  subtitle:
    historicalArticleData.subtitle ??
    "Despite a historically relaxed view of homosexuality, China seems reluctant to embrace gay rights",
  source: historicalArticleData.source ?? "The Economist explains",
  date: historicalArticleData.date ?? "Jun 6th 2017",
  readTime: historicalArticleData.readTime,
  active: true,
  content: historicalArticleBody.trim(),
};

/**
 * Compose a single markdown source containing the title, subtitle, meta line,
 * and article body. This becomes the source of truth for both views — the
 * Dig text view re-parses it on every keystroke so edits are reflected live.
 */
const composeRaw = (a: Article): string => {
  const meta = [a.source, a.date, a.readTime].filter(Boolean).join(" · ");
  return `# ${a.title}

*${a.subtitle}*

${meta}

---

${a.content ?? ""}`;
};

const ArticleV1 = () => {
  const { articleId } = useParams();
  const article = !articleId || articleId === historicalArticle.id ? historicalArticle : undefined;

  const [tab, setTab] = useState<ViewTab>("dig");
  const [rawContent, setRawContent] = useState(() => (article ? composeRaw(article) : ""));

  // Reset editable buffer when navigating to a different article
  useEffect(() => {
    if (article) {
      setRawContent(composeRaw(article));
      setTab("dig");
    }
  }, [article]);

  if (!article?.active || !article.content) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Library link + tab switcher on the same row */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            to="/articles"
            className="inline-flex items-center gap-1.5 text-xs font-sans font-medium tracking-wider uppercase text-neutral-500 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:text-neutral-50"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            <span className="font-sans text-sm font-medium tracking-wider uppercase">
              All Articles
            </span>
          </Link>

          <div
            role="tablist"
            aria-label="View mode"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-0.5 dark:bg-neutral-900 dark:border-neutral-800"
          >
            <button
              role="tab"
              aria-selected={tab === "dig"}
              onClick={() => setTab("dig")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-colors",
                tab === "dig"
                  ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50",
              )}
            >
              Dig text
            </button>
            <button
              role="tab"
              aria-selected={tab === "raw"}
              onClick={() => setTab("raw")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-colors",
                tab === "raw"
                  ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50",
              )}
            >
              Raw text
            </button>
          </div>
        </div>

        {tab === "dig" ? (
          <DigText content={rawContent} />
        ) : (
          <div>
            <p className="font-sans text-xs text-neutral-500 mb-2 dark:text-neutral-400">
              Markdown source · edits update the Dig text view live
            </p>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[70vh] rounded-md border border-neutral-200 bg-neutral-50/50 px-4 py-3 font-mono text-sm leading-relaxed text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-y dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-50 dark:focus:ring-neutral-700"
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticleV1;
