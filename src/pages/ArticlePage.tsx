import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DigText from "@/components/DigText";
import { getArticleById } from "@/content/articles";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

type ViewTab = "dig" | "raw";

const ArticlePage = () => {
  const { articleId } = useParams();
  const article = getArticleById(articleId);

  const [tab, setTab] = useState<ViewTab>("dig");
  const [rawContent, setRawContent] = useState(article?.content ?? "");

  // Reset editable buffer when navigating to a different article
  useEffect(() => {
    setRawContent(article?.content ?? "");
    setTab("dig");
  }, [article?.id, article?.content]);

  if (!article?.active || !article.content) {
    return <NotFound />;
  }

  const meta = [article.source, article.date, article.readTime].filter(Boolean).join(" · ");

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
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-sans font-medium tracking-wider uppercase text-expand-button hover:text-expand-button-hover transition-colors mb-8">
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span className="font-sans text-sm font-medium tracking-wider uppercase">
            All Articles
          </span>
        </Link>

        <div className="mb-8">
          <p className="font-sans text-xs text-muted-foreground tracking-wider uppercase mb-3">
            {meta}
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold leading-tight mb-4 text-foreground">
            {article.title}
          </h2>
          <p className="text-lg font-serif italic text-muted-foreground leading-relaxed">
            {article.subtitle}
          </p>
        </div>

        {/* Pill tab switcher */}
        <div className="mb-8 flex justify-start">
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

        <div className="w-12 h-px bg-border mb-8" />

        {tab === "dig" ? (
          <DigText key={`${article.id}-${rawContent.length}`} content={rawContent} />
        ) : (
          <div>
            <p className="font-sans text-xs text-muted-foreground mb-2">
              Markdown source · edits update the Dig text view live
            </p>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[60vh] rounded-md border border-border bg-muted/30 px-4 py-3 font-mono text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticlePage;
