import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DigText from "@/components/DigText";
import { getArticleById, type Article } from "@/content/articles";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

type ViewTab = "dig" | "raw";

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

const ArticlePage = () => {
  const { articleId } = useParams();
  const article = getArticleById(articleId);

  const [tab, setTab] = useState<ViewTab>("dig");
  const [rawContent, setRawContent] = useState(() => (article ? composeRaw(article) : ""));

  // Reset editable buffer when navigating to a different article
  useEffect(() => {
    if (article) {
      setRawContent(composeRaw(article));
      setTab("dig");
    }
  }, [article?.id]);

  if (!article?.active || !article.content) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="font-sans text-sm font-semibold tracking-[0.2em] uppercase text-foreground">
            Dig.txt
          </h1>
          <p className="font-sans text-xs text-muted-foreground tracking-wide">
            Progressive reading
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* All Articles link + tab switcher on the same row */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-sans font-medium tracking-wider uppercase text-expand-button hover:text-expand-button-hover transition-colors"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            <span className="font-sans text-sm font-medium tracking-wider uppercase">
              All Articles
            </span>
          </Link>

          <div
            role="tablist"
            aria-label="View mode"
            className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
          >
            <button
              role="tab"
              aria-selected={tab === "dig"}
              onClick={() => setTab("dig")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-colors",
                tab === "dig"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
            <p className="font-sans text-xs text-muted-foreground mb-2">
              Markdown source · edits update the Dig text view live
            </p>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[70vh] rounded-md border border-border bg-muted/30 px-4 py-3 font-mono text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticlePage;
