import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import { articles } from "@/content/articles";
import { cn } from "@/lib/utils";

const ArticlesV2 = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-[220px] h-[560px] w-[560px] rounded-full opacity-[.35] blur-[90px]"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,.35) 0%, rgba(244,114,182,.18) 45%, transparent 75%)",
          }}
        />

        <main className="relative mx-auto max-w-3xl px-6 pt-16 pb-24">
          <div className="mb-3">
            <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
              the library
            </span>
          </div>

          <h1
            className="mt-3 tracking-tight text-[clamp(2.4rem,6.2vw,3.6rem)] leading-[1.02]"
            style={{
              fontFamily: "'IBM Plex Serif', Georgia, serif",
              textWrap: "balance",
            }}
          >
            A few texts, ready to{" "}
            <span className="italic text-neutral-500 dark:text-neutral-400">
              dig into.
            </span>
          </h1>

          <div className="mt-14 divide-y divide-neutral-100 dark:divide-neutral-800">
            {articles.map((article) => {
              const inner = (
                <div className="group py-8">
                  <p className="mb-3 font-sans text-[10px] tracking-[0.25em] uppercase text-neutral-400 dark:text-neutral-500">
                    {article.source}
                  </p>
                  <h2
                    className={cn(
                      "mb-3 text-[clamp(1.4rem,2.8vw,1.85rem)] leading-[1.15] tracking-tight",
                      article.active
                        ? "text-neutral-900 transition-colors group-hover:text-neutral-500 dark:text-neutral-50 dark:group-hover:text-neutral-400"
                        : "text-neutral-300 dark:text-neutral-700",
                    )}
                    style={{
                      fontFamily: "'IBM Plex Serif', Georgia, serif",
                      textWrap: "balance",
                    }}
                  >
                    {article.title}
                  </h2>
                  <p
                    className={cn(
                      "max-w-2xl text-[1.05rem] leading-relaxed",
                      article.active
                        ? "text-neutral-600 dark:text-neutral-300"
                        : "text-neutral-300 dark:text-neutral-700",
                    )}
                    style={{ fontFamily: "'IBM Plex Serif', Georgia, serif" }}
                  >
                    {article.subtitle}
                  </p>
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
                <div key={article.id} className="cursor-default">
                  {inner}
                </div>
              );
            })}
          </div>
        </main>
      </section>
    </div>
  );
};

export default ArticlesV2;
