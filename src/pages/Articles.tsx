import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import { articles } from "@/content/articles";
import { cn } from "@/lib/utils";

const Articles = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="font-serif text-3xl md:text-4xl font-semibold leading-tight text-neutral-900 mb-2 dark:text-neutral-50">
            Library
          </h2>
          <p className="font-serif text-base italic text-neutral-500 dark:text-neutral-400">
            Choose a text to explore at your own depth
          </p>
        </div>

        <div className="space-y-0 divide-y divide-neutral-100 dark:divide-neutral-800">
          {articles.map((article) => {
            const inner = (
              <div className="py-6 group">
                <p className="font-sans text-xs text-neutral-400 tracking-wider uppercase mb-2 dark:text-neutral-500">
                  {article.source} · {article.date}
                </p>
                <h3
                  className={cn(
                    "text-xl font-serif font-semibold leading-snug mb-1.5",
                    article.active
                      ? "text-neutral-900 group-hover:text-rose-500 transition-colors dark:text-neutral-50"
                      : "text-neutral-400 dark:text-neutral-600",
                  )}
                >
                  {article.title}
                </h3>
                <p
                  className={cn(
                    "text-sm font-serif leading-relaxed",
                    article.active
                      ? "text-neutral-500 dark:text-neutral-400"
                      : "text-neutral-300 dark:text-neutral-700",
                  )}
                >
                  {article.subtitle}
                </p>
                {!article.active && (
                  <span className="inline-block mt-2 text-xs font-sans tracking-wider uppercase text-neutral-300 dark:text-neutral-700">
                    Coming soon
                  </span>
                )}
              </div>
            );

            return article.active ? (
              <Link
                key={article.id}
                to={`/article/${article.id}`}
                className="block"
              >
                {inner}
              </Link>
            ) : (
              <div key={article.id} className="opacity-60 cursor-default">
                {inner}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Articles;
