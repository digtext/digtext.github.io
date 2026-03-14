import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DigText from "@/components/DigText";
import { getArticleById } from "@/content/articles";
import NotFound from "./NotFound";

const ArticlePage = () => {
  const { articleId } = useParams();
  const article = getArticleById(articleId);

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

        <div className="w-12 h-px bg-border mb-8" />

        <DigText key={article.id} content={article.content} />
      </main>
    </div>
  );
};

export default ArticlePage;
