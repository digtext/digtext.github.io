import { Link } from "react-router-dom";
import { articles } from "@/content/articles";

const Home = () => {
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
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold leading-tight text-foreground mb-2">
            Library
          </h2>
          <p className="text-base font-serif italic text-muted-foreground">
            Choose a text to explore at your own depth
          </p>
        </div>

        <div className="space-y-0 divide-y divide-border">
          {articles.map((article) => {
            const inner = (
              <div className="py-6 group">
                <p className="font-sans text-xs text-muted-foreground tracking-wider uppercase mb-2">
                  {article.source} · {article.date}
                </p>
                <h3 className={`text-xl font-serif font-semibold leading-snug mb-1.5 ${article.active ? "text-foreground group-hover:text-primary transition-colors" : "text-muted-foreground"}`}>
                  {article.title}
                </h3>
                <p className={`text-sm font-serif leading-relaxed ${article.active ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                  {article.subtitle}
                </p>
                {!article.active && (
                  <span className="inline-block mt-2 text-xs font-sans tracking-wider uppercase text-muted-foreground/40">
                    Coming soon
                  </span>
                )}
              </div>
            );

            return article.active ? (
              <Link key={article.id} to={`/article/${article.id}`} className="block">
                {inner}
              </Link>
            ) : (
              <div key={article.id} className="opacity-60 cursor-default">
                {inner}
              </div>
            );
          })}
        </div>

        <div className="mt-16 pt-8 border-t border-border">
          <h3 className="font-sans text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-4">
            What is Dig.txt?
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground font-serif">
            Dig.txt presents text in its most collapsed form by default. Click the{" "}
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-expand-button text-expand-button align-middle mx-0.5">
              <span className="text-xs">+</span>
            </span>{" "}
            buttons to expand sections you find valuable or interesting.
            This reverses the traditional approach of showing everything at once,
            letting you dig into the depth you choose.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Home;
